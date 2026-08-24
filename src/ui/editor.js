import { h } from "../core/dom.js";
import { openDialog, confirmDialog } from "./dialog.js";
import { ICONS } from "../core/icons.js";
import { toast, toastError } from "./toast.js";
import * as api from "../core/api.js";
import * as fmt from "../core/format.js";
import { get, set } from "../core/store.js";

const MAX_EDIT = 8 * 1024 * 1024;

export async function openEditor(path, onSaved) {
  let chunk;
  try {
    chunk = await api.readTextChunk(path, 0, MAX_EDIT);
  } catch (err) {
    return toastError(err, "Faylni ochib bo'lmadi");
  }
  if (!chunk) return toastError(new Error("Backend bo'sh javob qaytardi"), "Faylni ochib bo'lmadi");
  if (chunk.isBinary) {
    const go = await confirmDialog({
      title: "Ikkilik fayl",
      message: "Bu fayl ikkilik ko'rinadi. Matn sifatida tahrirlash uni buzishi mumkin.",
      okLabel: "Baribir tahrirlash",
      variant: "danger",
      icon: ICONS.binary,
    });
    if (!go) return;
  }
  if (!chunk.eof) {
    toast(`Faqat dastlabki ${fmt.shortSize(chunk.readBytes)} yuklandi — saqlash faylni qisqartiradi.`,
      { kind: "warn", title: "Fayl juda katta", timeout: 8000 });
  }
  const name = fmt.baseName(path);
  let dirty = false;
  let lineEnding = chunk.lineEnding || get("editorLineEnding");
  const status = h("span", { class: "meta" });
  const area = h("textarea", {
    class: "editor__area",
    spellcheck: "false",
    value: chunk.content,
    on: {
      input: () => { dirty = true; updateStatus(); },
      keydown: (e) => {
        e.stopPropagation();
        if (e.key === "Tab") {
          e.preventDefault();
          const s = area.selectionStart, en = area.selectionEnd;
          area.setRangeText("\t", s, en, "end");
          dirty = true; updateStatus();
        }
        if (e.key === "s" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
      },
      click: updateStatus,
      keyup: updateStatus,
    },
  });

  const leSel = h("select", {
    class: "select", style: { width: "auto", padding: "3px 26px 3px 8px", fontSize: "11.5px" },
    on: { change: () => { lineEnding = leSel.value; dirty = true; updateStatus(); } },
  }, ...["LF", "CRLF", "CR"].map((v) => h("option", { value: v, text: v, selected: v === lineEnding })));

  const bar = h("div", { class: "viewer__bar" },
    h("span", { class: "meta", text: chunk.encoding }),
    leSel,
    h("div", { class: "grow" }),
    status,
  );

  const body = h("div", { class: "viewer" }, bar, h("div", { class: "viewer__body", style: { display: "flex" } }, area));

  const dlg = openDialog({
    title: `Tahrir — ${name}`,
    icon: ICONS.edit,
    size: "xl",
    body,
    closable: true,
    buttons: [
      "spacer",
      { label: "Yopish", onClick: () => tryClose() },
      { label: "Saqlash", icon: ICONS.save, variant: "primary", default: true, onClick: () => save() },
    ],
    onKeydown: (e) => {
      if (e.key === "Escape") { e.preventDefault(); tryClose(); return true; }
      return false;
    },
  });

  function updateStatus() {
    const text = area.value;
    const upto = text.slice(0, area.selectionStart);
    const line = upto.split("\n").length;
    const col = upto.length - upto.lastIndexOf("\n");
    status.textContent = `${dirty ? "● " : ""}Qator ${line}, Ustun ${col} · ${text.split("\n").length} qator · ${fmt.shortSize(new Blob([text]).size)}`;
  }

  async function save() {
    try {
      await api.writeTextFile(path, area.value, lineEnding);
      dirty = false;
      set({ editorLineEnding: lineEnding });
      updateStatus();
      toast(name, { kind: "ok", title: "Saqlandi" });
      onSaved?.();
    } catch (err) {
      toastError(err, "Saqlab bo'lmadi");
    }
  }

  async function tryClose() {
    if (dirty) {
      const ok = await confirmDialog({
        title: "Saqlanmagan o'zgarishlar",
        message: `“${name}” dagi o'zgarishlar bekor qilinsinmi?`,
        okLabel: "Bekor qilish",
        variant: "danger",
      });
      if (!ok) return;
    }
    dlg.close(null);
  }

  updateStatus();
  requestAnimationFrame(() => area.focus());
  return dlg.result;
}
