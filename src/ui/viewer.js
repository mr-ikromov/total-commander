import { h, clear, svg } from "../core/dom.js";
import { openDialog } from "./dialog.js";
import { ICONS } from "../core/icons.js";
import { toastError } from "./toast.js";
import * as api from "../core/api.js";
import * as fmt from "../core/format.js";
import { get, set } from "../core/store.js";
import { convertFileSrc } from "../core/tauri.js";

const TEXT_PAGE = 512 * 1024;
const HEX_PAGE = 64 * 1024;
const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "ico", "avif"]);

export async function openViewer(path, { startMode = null } = {}) {
  const name = fmt.baseName(path);
  const ext = (name.split(".").pop() || "").toLowerCase();
  const bodyWrap = h("div", { class: "viewer__body" });
  const metaEl = h("span", { class: "meta", text: "…" });
  let mode = startMode || (IMAGE_EXT.has(ext) ? "image" : "text");
  let offset = 0;
  let wrap = get("viewerWrap");
  let chunk = null;
  let pageStack = [];
  let firstLine = 1;
  const modeBtns = {};
  const seg = h("div", { class: "seg" },
    ...["text", "code", "hex", "image"].map((m) =>
      modeBtns[m] = h("button", {
        type: "button", text: { text: "Matn", code: "Kod", hex: "Hex", image: "Rasm" }[m],
        "aria-pressed": String(m === mode),
        on: { click: () => switchMode(m) },
      })),
  );

  const wrapBtn = h("button", {class: "btn btn--ghost", type: "button", title: "Satrlarni o'rash (Ctrl+W)", "aria-pressed": String(wrap),
    on: { click: () => { wrap = !wrap; set({ viewerWrap: wrap }); wrapBtn.setAttribute("aria-pressed", String(wrap)); render(); } },
  }, svg(ICONS.wrap));

  const prevBtn = h("button", { class: "btn btn--ghost", type: "button", title: "Oldingi sahifa", on: { click: () => page(-1) } }, svg(ICONS.chevronLeft));
  const nextBtn = h("button", { class: "btn btn--ghost", type: "button", title: "Keyingi sahifa", on: { click: () => page(1) } }, svg(ICONS.chevronRight));

  const bar = h("div", { class: "viewer__bar" },
    seg,
    h("div", { class: "grow" }),
    metaEl,
    wrapBtn, prevBtn, nextBtn,
  );

  const body = h("div", { class: "viewer" }, bar, bodyWrap);

  const dlg = openDialog({
    title: name,
    icon: ICONS.eye,
    size: "xl",
    body,
    buttons: [
      "spacer",
      { label: "Matndan nusxa olish", icon: ICONS.copy, onClick: () => copyVisible() },
      { label: "Yopish", variant: "primary", default: true, onClick: (a) => a.close(null) },
    ],
    onKeydown: (e) => {
      if (e.key === "PageDown" || (e.key === "ArrowRight" && e.ctrlKey)) { e.preventDefault(); page(1); return true; }
      if (e.key === "PageUp" || (e.key === "ArrowLeft" && e.ctrlKey)) { e.preventDefault(); page(-1); return true; }
      if (e.key.toLowerCase() === "w" && e.ctrlKey) { e.preventDefault(); wrapBtn.click(); return true; }
      if (e.key === "F3") { e.preventDefault(); a_close(); return true; }
      return false;
    },
  });
  const a_close = () => dlg.close(null);

  function switchMode(m) {
    mode = m;
    offset = 0;
    pageStack = [];
    firstLine = 1;
    for (const [k, b] of Object.entries(modeBtns)) b.setAttribute("aria-pressed", String(k === m));
    load();
  }

  function page(dir) {
    if (mode === "image" || !chunk) return;
    if (dir > 0) {
      if (chunk.eof) return;
      pageStack.push({ offset, firstLine });
      offset += chunk.consumedBytes;
      firstLine += countLines(chunk.content);
    } else {
      const prev = pageStack.pop();
      if (!prev) return;
      offset = prev.offset;
      firstLine = prev.firstLine;
    }
    load();
  }

  function countLines(text) {
    let n = 0;
    for (let i = 0; i < text.length; i++) if (text[i] === "\n") n++;
    return n;
  }

  async function load() {
    if (mode === "image") { render(); return; }
    try {
      chunk = mode === "hex"
        ? await api.readHexChunk(path, offset, HEX_PAGE)
        : await api.readTextChunk(path, offset, TEXT_PAGE);
      if (mode !== "hex" && chunk.isBinary && !startMode) { switchMode("hex"); return; }
      trimToLineBoundary();
      render();
    } catch (err) {
      toastError(err, "Faylni o'qib bo'lmadi");
      clear(bodyWrap).appendChild(h("div", { class: "rows__empty", text: String(err) }));
    }
  }

  function trimToLineBoundary() {
    chunk.consumedBytes = chunk.readBytes;
    if (mode === "hex" || chunk.eof) return;
    const cut = chunk.content.lastIndexOf("\n");
    if (cut < 0) return;
    const kept = chunk.content.slice(0, cut + 1);
    chunk.consumedBytes = new TextEncoder().encode(kept).length;
    chunk.content = kept;
  }

  function render() {
    clear(bodyWrap);
    if (mode === "image") {
      bodyWrap.appendChild(h("div", { class: "viewer__img" },
        h("img", { src: convertFileSrc(path), alt: name })));
      metaEl.textContent = "rasm";
      return;
    }
    if (!chunk) return;
    const pct = chunk.totalBytes ? ((offset + chunk.consumedBytes) / chunk.totalBytes) * 100 : 100;
    metaEl.textContent =
      `${chunk.encoding} · ${chunk.lineEnding} · ${fmt.shortSize(chunk.totalBytes)} · ${pct.toFixed(0)}%`;
    prevBtn.disabled = pageStack.length === 0;
    nextBtn.disabled = !!chunk.eof;

    if (mode === "code") {
      const lines = chunk.content.split("\n");
      const gutter = h("pre", { class: "viewer__gutter",
        text: lines.map((_, i) => firstLine + i).join("\n") });
      const pre = h("pre", { class: "viewer__text", dataset: { wrap: wrap ? "1" : "0" }, text: chunk.content });
      bodyWrap.appendChild(h("div", { class: "viewer__code" }, gutter, pre));
    } else {
      bodyWrap.appendChild(h("pre", {
        class: "viewer__text",
        dataset: { wrap: mode === "hex" ? "0" : wrap ? "1" : "0" },
        text: chunk.content,
      }));
    }
    bodyWrap.scrollTop = 0;
  }

  async function copyVisible() {
    const text = chunk?.content || "";
    try {
      await api.clipboardWrite(text);
    } catch (err) {
      toastError(err, "Bufer ishlamadi");
    }
  }

  load();
  return dlg.result;
}
