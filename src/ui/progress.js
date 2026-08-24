import { h } from "../core/dom.js";
import { openDialog } from "./dialog.js";
import { ICONS } from "../core/icons.js";
import * as fmt from "../core/format.js";
import * as api from "../core/api.js";

const TITLES = {
  copy: "Fayllar nusxalanmoqda",
  move: "Fayllar ko'chirilmoqda",
  delete: "Fayllar o'chirilmoqda",
  pack: "Arxiv yaratilmoqda",
  extract: "Arxiv chiqarilmoqda",
};

export function openProgress(jobId, kind = "copy") {
  const pathEl = h("div", { class: "prog-path", text: "…" });
  const bar = h("div", { class: "prog__bar" });
  const fileBar = h("div", { class: "prog__bar" });
  const metaTop = h("div", { class: "prog-meta" }, h("span", { text: "0 / 0 fayl" }), h("span", { text: "0 %" }));
  const metaBottom = h("div", { class: "prog-meta" }, h("span", { text: "—" }), h("span", { text: "" }));
  const errBox = h("div", {
    style: {
      display: "none", marginTop: "10px", maxHeight: "120px", overflow: "auto",
      fontSize: "11px", color: "var(--danger)", fontFamily: "var(--font-mono)",
      whiteSpace: "pre-wrap", userSelect: "text",
    },
  });

  const body = h("div", {},
    pathEl,
    h("div", { class: "prog" }, bar),
    metaTop,
    h("div", { style: { marginTop: "10px", fontSize: "11px", color: "var(--fg-faint)" }, text: "Joriy fayl" }),
    h("div", { class: "prog prog--file" }, fileBar),
    metaBottom,
    errBox,
  );

  let cancelled = false;
  const dlg = openDialog({
    title: TITLES[kind] || "Bajarilmoqda",
    icon: ICONS[kind === "delete" ? "trash" : kind === "move" ? "move" : "copy"] || ICONS.copy,
    size: "sm",
    closable: false,
    body,
    buttons: [
      "spacer",
      {
        label: "Bekor qilish", variant: "danger",
        onClick: () => { cancelled = true; api.cancelJob(jobId); },
      },
    ],
  });

  function update(ev) {
    if (!ev || ev.jobId !== jobId) return;
    pathEl.textContent = ev.currentFile || "…";
    pathEl.title = ev.currentFile || "";
    const pct = ev.bytesTotal ? fmt.percent(ev.bytesDone, ev.bytesTotal) : fmt.percent(ev.filesDone, ev.filesTotal);
    bar.style.width = `${pct.toFixed(1)}%`;
    fileBar.style.width = `${fmt.percent(ev.fileBytesDone, ev.fileBytesTotal).toFixed(1)}%`;
    metaTop.children[0].textContent = `${ev.filesDone} / ${ev.filesTotal} fayl · ${fmt.shortSize(ev.bytesTotal)} dan ${fmt.shortSize(ev.bytesDone)}`;
    metaTop.children[1].textContent = `${pct.toFixed(0)} %`;
    metaBottom.children[0].textContent = fmt.speed(ev.speedBps);
    metaBottom.children[1].textContent = ev.etaSecs ? `${fmt.duration(ev.etaSecs)} qoldi` : "";
    if (ev.errors?.length) {
      errBox.style.display = "block";
      errBox.textContent = ev.errors.slice(-20).join("\n");
    }
  }

  return {
    update,
    close: () => dlg.close(null),
    get cancelled() { return cancelled; },
    dialog: dlg,
  };
}

export function summarize(ev) {
  if (!ev) return "Tayyor";
  const bits = [];
  if (ev.filesDone) bits.push(`${ev.filesDone} ta fayl`);
  if (ev.bytesDone) bits.push(fmt.shortSize(ev.bytesDone));
  if (ev.cancelled) bits.push("bekor qilindi");
  return bits.join(" · ") || "Tayyor";
}
