import { h } from "../core/dom.js";
import { openDialog, confirmDialog, promptDialog } from "./dialog.js";
import { openProgress, summarize } from "./progress.js";
import { toast, toastError } from "./toast.js";
import { ICONS } from "../core/icons.js";
import * as api from "../core/api.js";
import * as fmt from "../core/format.js";
import { get } from "../core/store.js";

const CONFLICTS = [
  ["ask", "So'rash (nomini o'zgartirib)"],
  ["overwrite", "Mavjud fayllar ustiga yozish"],
  ["skip", "Mavjud fayllarni o'tkazib yuborish"],
  ["rename", "Takrorlarni avto nomlash"],
  ["newer", "Faqat eskilarini almashtirish"],
];

function describe(items) {
  if (items.length === 1) return `“${items[0].fileName}”`;
  const dirs = items.filter((i) => i.isDir).length;
  const files = items.length - dirs;
  const parts = [];
  if (files) parts.push(`${files} ta fayl`);
  if (dirs) parts.push(`${dirs} ta papka`);
  return parts.join(" va ");
}

function askTarget({ title, icon, items, defaultTarget, okLabel }) {
  const single = items.length === 1;
  let targetInput, conflictSel, keepTimes;
  const body = h("div", {},
    h("p", {}, `${okLabel} ${describe(items)}`,
      h("br"),
      h("span", { style: { color: "var(--fg-faint)", fontSize: "11.5px" },
        text: `jami ${fmt.shortSize(items.reduce((a, i) => a + (i.size || 0), 0))}` })),
    h("div", { class: "field" },
      h("label", { text: single ? "Nishon (papka yoki to'liq yangi nom)" : "Nishon papka" }),
      targetInput = h("input", {
        class: "input input--mono", type: "text",
        value: single ? `${defaultTarget}` : defaultTarget,
        spellcheck: "false",
      }),
    ),
    h("div", { class: "field" },
      h("label", { text: "Agar nishon mavjud bo'lsa" }),
      conflictSel = h("select", { class: "select" },
        ...CONFLICTS.map(([v, l]) => h("option", { value: v, text: l, selected: v === get("defaultConflict") }))),
    ),
    h("label", { class: "check" },
      keepTimes = h("input", { type: "checkbox", checked: get("preserveTimes") }),
      "O'zgartirish vaqtini saqlash"),
  );

  const dlg = openDialog({
    title, icon, size: "md", body,
    buttons: [
      "spacer",
      { label: "Bekor qilish", onClick: (a) => a.close(null) },
      {
        label: okLabel, variant: "primary", default: true,
        onClick: (a) => {
          const raw = targetInput.value.trim();
          if (!raw) return;
          a.close({
            target: raw,
            conflict: conflictSel.value,
            preserveTimes: keepTimes.checked,
          });
        },
      },
    ],
  });
  requestAnimationFrame(() => { targetInput.focus(); targetInput.select(); });
  return dlg.result;
}

async function resolveTarget(raw, items, sep, fallbackDir) {
  const endsWithSep = /[\\/]$/.test(raw);
  if (endsWithSep) return { dir: raw.replace(/[\\/]+$/, "") || sep, renameTo: null };
  if (!/[\\/]/.test(raw)) {
    return items.length === 1
      ? { dir: fallbackDir, renameTo: raw }
      : { dir: `${fallbackDir.replace(/[\\/]+$/, "")}${sep}${raw}`, renameTo: null };
  }
  const exists = await api.pathExists(raw).catch(() => false);
  if (exists) {
    const st = await api.statPath(raw).catch(() => null);
    if (st?.isDir) return { dir: raw, renameTo: null };
  }
  if (items.length === 1) {
    return { dir: fmt.dirName(raw), renameTo: fmt.baseName(raw) };
  }
  return { dir: raw, renameTo: null };
}

async function runJob(kind, req, onProgressRef) {
  const prog = openProgress(req.jobId, kind);
  onProgressRef.current = prog;
  try {
    const fn = kind === "move" ? api.moveItems : api.copyItems;
    const ev = await fn(req);
    prog.close();
    return ev;
  } catch (err) {
    prog.close();
    throw err;
  } finally {
    onProgressRef.current = null;
  }
}

export async function transfer(app, kind) {
  const src = app.active();
  const dst = app.inactive();
  const items = src.selection();
  if (!items.length) return toast("Hech narsa belgilanmagan", { kind: "warn" });

  const answer = await askTarget({
    title: kind === "move" ? "Ko'chirish / Nomlash" : "Nusxalash",
    icon: kind === "move" ? ICONS.move : ICONS.copy,
    items,
    defaultTarget: dst.path,
    okLabel: kind === "move" ? "Ko'chirish" : "Nusxalash",
  });
  if (!answer) return;

  const { dir, renameTo } = await resolveTarget(answer.target, items, app.sep, dst.path);
  const req = api.makeOpRequest(items.map((i) => i.path), dir, {
    conflict: answer.conflict === "ask" ? "rename" : answer.conflict,
    preserveTimes: answer.preserveTimes,
    renameTo,
  });

  try {
    const ev = await runJob(kind, req, app.progressRef);
    await Promise.all([src.reload(), dst.reload()]);
    if (ev?.errors?.length) {
      toast(ev.errors.slice(0, 5).join("\n"), { kind: "error", title: `${ev.errors.length} ta xatolik` });
    } else {
      toast(summarize(ev), { kind: ev?.cancelled ? "warn" : "ok", title: kind === "move" ? "Ko'chirildi" : "Nusxalandi" });
    }
  } catch (err) {
    toastError(err, kind === "move" ? "Ko'chirib bo'lmadi" : "Nusxalab bo'lmadi");
  }
}

export async function remove(app, { toTrash = null } = {}) {
  const panel = app.active();
  const items = panel.selection();
  if (!items.length) return toast("Hech narsa belgilanmagan", { kind: "warn" });

  const useTrash = toTrash ?? get("deleteToTrash");
  if (get("confirmDelete")) {
    const ok = await confirmDialog({
      title: useTrash ? "Savatga tashlash" : "Butunlay o'chirish",
      icon: ICONS.trash,
      message: `${describe(items)} ${useTrash ? "savatga tashlansinmi" : "butunlay o'chirilsinmi"}?`,
      detail: items.length <= 6
        ? items.map((i) => i.path).join("\n")
        : `${items.slice(0, 5).map((i) => i.fileName).join(", ")} … +${items.length - 5} ta`,
      okLabel: useTrash ? "Savatga tashlash" : "O'chirish",
      variant: "danger",
    });
    if (!ok) return;
  }

  const jobId = api.newJobId();
  const prog = openProgress(jobId, "delete");
  app.progressRef.current = prog;
  try {
    const ev = await api.deleteItems(jobId, items.map((i) => i.path), useTrash);
    prog.close();
    await panel.reload(false);
    if (app.inactive().path === panel.path) await app.inactive().reload();
    if (ev?.errors?.length) toast(ev.errors.slice(0, 5).join("\n"), { kind: "error", title: "O'chirishda xatolik" });
    else toast(`${ev.filesDone} ta element olib tashlandi`, { kind: "ok", title: useTrash ? "Savatga tashlandi" : "O'chirildi" });
  } catch (err) {
    prog.close();
    toastError(err, "O'chirib bo'lmadi");
  } finally {
    app.progressRef.current = null;
  }
}

export async function makeDir(app) {
  const panel = app.active();
  const name = await promptDialog({
    title: "Yangi papka yaratish",
    icon: ICONS.newFolder,
    label: "Papka nomi (ichma-ich yo'l ham mumkin)",
    placeholder: "yangi-papka",
    okLabel: "Yaratish",
  });
  if (!name) return;
  const target = name.match(/^([a-zA-Z]:[\\/]|[\\/])/) ? name : await api.joinPath(panel.path, name);
  try {
    await api.createDir(target);
    await panel.reload();
    const leaf = fmt.baseName(target);
    const i = panel.view.findIndex((e) => e.fileName === leaf);
    if (i >= 0) { panel.setCursor(i); panel._scheduleRender(); }
    toast(target, { kind: "ok", title: "Papka yaratildi" });
  } catch (err) {
    toastError(err, "Papka yaratib bo'lmadi");
  }
}

export async function makeFile(app) {
  const panel = app.active();
  const name = await promptDialog({
    title: "Yangi fayl yaratish",
    icon: ICONS.file,
    label: "Fayl nomi",
    placeholder: "qaydlar.txt",
    okLabel: "Yaratish",
  });
  if (!name) return;
  const target = await api.joinPath(panel.path, name);
  try {
    await api.createFile(target);
    await panel.reload();
    const i = panel.view.findIndex((e) => e.fileName === name);
    if (i >= 0) { panel.setCursor(i); panel._scheduleRender(); }
    const { openEditor } = await import("./editor.js");
    openEditor(target, () => panel.reload());
  } catch (err) {
    toastError(err, "Fayl yaratib bo'lmadi");
  }
}

export async function renameInPlace(app) {
  const panel = app.active();
  const entry = panel.cursorEntry;
  if (!entry || entry.isParent) return;
  const dot = entry.isDir ? -1 : entry.fileName.lastIndexOf(".");
  const newName = await promptDialog({
    title: "Nomini o'zgartirish",
    icon: ICONS.rename,
    label: "Yangi nom",
    value: entry.fileName,
    okLabel: "O'zgartirish",
    selectRange: dot > 0 ? [0, dot] : null,
    validate: (v) => (!v ? "Nom kerak" : /[\\/]/.test(v) ? "Nomda yo'l ajratgichi bo'lmasligi kerak" : null),
  });
  if (!newName || newName === entry.fileName) return;
  try {
    await api.renamePath(entry.path, newName);
    await panel.reload();
    const i = panel.view.findIndex((e) => e.fileName === newName);
    if (i >= 0) { panel.setCursor(i); panel._scheduleRender(); }
    toast(`${entry.fileName} → ${newName}`, { kind: "ok", title: "Nomi o'zgartirildi" });
  } catch (err) {
    toastError(err, "Nomini o'zgartirib bo'lmadi");
  }
}
