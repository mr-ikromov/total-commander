import { h, clear, svg } from "../core/dom.js";
import { openDialog } from "./dialog.js";
import { openProgress } from "./progress.js";
import { ICONS } from "../core/icons.js";
import { toast, toastError } from "./toast.js";
import * as api from "../core/api.js";
import * as fmt from "../core/format.js";
import { get, set } from "../core/store.js";

const FORMATS = [
  ["zip", "ZIP (.zip)"],
  ["tar.gz", "Gzip tar (.tar.gz)"],
  ["tar", "Tar (.tar)"],
];

export async function openPack(app) {
  const panel = app.active();
  const items = panel.selection();
  if (!items.length) return toast("Hech narsa belgilanmagan", { kind: "warn" });
  const defaultName = items.length === 1 ? items[0].name : fmt.baseName(panel.path) || "archive";
  const fmtSel = h("select", { class: "select" }, ...FORMATS.map(([v, l]) => h("option", { value: v, text: l })));
  const nameInput = h("input", { class: "input input--mono", type: "text", value: `${defaultName}.zip` });
  const dirInput = h("input", { class: "input input--mono", type: "text", value: app.inactive().path });
  const levelInput = h("input", { class: "input", type: "range", min: "0", max: "9", value: String(get("packLevel")) });
  const levelOut = h("span", { style: { fontFamily: "var(--font-mono)", fontSize: "11.5px" }, text: String(get("packLevel")) });
  const moveChk = h("input", { type: "checkbox" });
  fmtSel.addEventListener("change", () => {
    const base = nameInput.value.replace(/\.(zip|tar\.gz|tgz|tar)$/i, "");
    nameInput.value = `${base}.${fmtSel.value}`;
  });
  levelInput.addEventListener("input", () => { levelOut.textContent = levelInput.value; });

  const body = h("div", {},
    h("p", { text: `${panel.path} dan ${items.length} ta element arxivlanmoqda` }),
    h("div", { class: "row-2" },
      h("div", { class: "field" }, h("label", { text: "Format" }), fmtSel),
      h("div", { class: "field" }, h("label", { text: "Arxiv nomi" }), nameInput),
    ),
    h("div", { class: "field" }, h("label", { text: "Nishon papka" }), dirInput),
    h("div", { class: "field" },
      h("label", { text: "Siqish darajasi" }),
      h("div", { class: "inline" }, levelInput, levelOut)),
    h("label", { class: "check" }, moveChk, "Arxivlangach asl fayllarni o'chirish"),
  );

  const dlg = openDialog({
    title: "Arxivlash", icon: ICONS.pack, size: "md", body,
    buttons: ["spacer",
      { label: "Bekor qilish", onClick: (a) => a.close(null) },
      { label: "Arxivlash", variant: "primary", default: true, onClick: (a) => a.close(true) }],
  });
  if (!(await dlg.result)) return;
  const archivePath = `${dirInput.value.trim().replace(/[\\/]+$/, "")}${app.sep}${nameInput.value.trim()}`;
  const level = Number(levelInput.value);
  set({ packLevel: level });
  const jobId = api.newJobId();
  const prog = openProgress(jobId, "pack");
  app.progressRef.current = prog;
  try {
    const ev = await api.archiveCreate(jobId, archivePath, items.map((i) => i.path), panel.path, level);
    prog.close();
    if (moveChk.checked && !ev.cancelled) {
      await api.deleteItems(api.newJobId(), items.map((i) => i.path), get("deleteToTrash"));
      await panel.reload();
    }
    await app.inactive().reload();
    toast(archivePath, { kind: ev.cancelled ? "warn" : "ok", title: ev.cancelled ? "Bekor qilindi" : "Arxiv yaratildi" });
  } catch (err) {
    prog.close();
    toastError(err, "Arxivlab bo'lmadi");
  } finally {
    app.progressRef.current = null;
  }
}

export async function openUnpack(app, forcedArchive = null) {
  const panel = app.active();
  const entry = forcedArchive
    ? { path: forcedArchive, fileName: fmt.baseName(forcedArchive) }
    : panel.cursorEntry;
  if (!entry || !(await api.archiveIsSupported(entry.path).catch(() => false))) {
    return toast(".zip, .tar, .tar.gz yoki .tgz arxivini tanlang", { kind: "warn" });
  }

  const dirInput = h("input", { class: "input input--mono", type: "text", value: app.inactive().path });
  const subChk = h("input", { type: "checkbox" });
  const body = h("div", {},
    h("p", { text: `“${entry.fileName}” chiqarilmoqda` }),
    h("div", { class: "field" }, h("label", { text: "Nishon papka" }), dirInput),
    h("label", { class: "check" }, subChk, "Arxiv nomi bilan ichki papkaga chiqarish"),
  );

  const dlg = openDialog({
    title: "Arxivdan chiqarish", icon: ICONS.unpack, size: "md", body,
    buttons: ["spacer",
      { label: "Bekor qilish", onClick: (a) => a.close(null) },
      { label: "Chiqarish", variant: "primary", default: true, onClick: (a) => a.close(true) }],
  });
  if (!(await dlg.result)) return;

  let target = dirInput.value.trim().replace(/[\\/]+$/, "");
  if (subChk.checked) {
    target = `${target}${app.sep}${entry.fileName.replace(/\.(zip|tar\.gz|tgz|tar|jar)$/i, "")}`;
  }

  const jobId = api.newJobId();
  const prog = openProgress(jobId, "extract");
  app.progressRef.current = prog;
  try {
    const ev = await api.archiveExtract(jobId, entry.path, target, []);
    prog.close();
    await app.inactive().reload();
    if (ev.errors?.length) toast(ev.errors.slice(0, 5).join("\n"), { kind: "error", title: "Chiqarishda xatolik" });
    else toast(`${ev.filesDone} ta yozuv chiqarildi`, { kind: "ok", title: "Chiqarildi" });
  } catch (err) {
    prog.close();
    toastError(err, "Chiqarib bo'lmadi");
  } finally {
    app.progressRef.current = null;
  }
}

export async function browseArchive(app, path) {
  let entries;
  try {
    entries = await api.archiveList(path);
  } catch (err) {
    return toastError(err, "Arxivni o'qib bo'lmadi");
  }
  if (!Array.isArray(entries)) {
    return toastError(new Error("Arxiv ro'yxati bo'sh qaytdi"), "Arxivni o'qib bo'lmadi");
  }
  const tbody = h("tbody");
  const selected = new Set();
  const paint = () => {
    clear(tbody);
    const frag = document.createDocumentFragment();
    entries.forEach((e, i) => {
      frag.appendChild(h("tr", {
        dataset: { i, sel: selected.has(e.path) ? "1" : "0" },
        on: {
          click: () => {
            if (selected.has(e.path)) selected.delete(e.path); else selected.add(e.path);
            paint();
          },
        },
      },
        h("td", {}, svg(e.isDir ? ICONS.folder : ICONS.file), " ", e.path),
        h("td", { class: "num", text: e.isDir ? "—" : fmt.shortSize(e.size) }),
        h("td", { class: "num", text: e.isDir ? "" : fmt.shortSize(e.packedSize) }),
        h("td", { class: "mono", text: e.modified ? fmt.stamp(e.modified) : "" }),
      ));
    });
    tbody.appendChild(frag);
  };

  const totalSize = entries.reduce((a, e) => a + e.size, 0);
  const packedSize = entries.reduce((a, e) => a + e.packedSize, 0);
  const ratio = totalSize ? ((1 - packedSize / totalSize) * 100).toFixed(1) : "0";
  const body = h("div", {},
    h("p", { text: `${entries.length} ta yozuv · ${fmt.shortSize(totalSize)} → ${fmt.shortSize(packedSize)} (${ratio}% tejaldi)` }),
    h("div", { class: "dtable-wrap", style: { maxHeight: "52vh" } },
      h("table", { class: "dtable" },
        h("thead", {}, h("tr", {},
          h("th", { text: "Yo'l" }), h("th", { class: "num", text: "Hajmi" }),
          h("th", { class: "num", text: "Siqilgan" }), h("th", { text: "O'zgartirilgan" }))),
        tbody)),
  );

  const dlg = openDialog({
    title: fmt.baseName(path),
    icon: ICONS.pack,
    size: "xl",
    body,
    buttons: [
      { label: "Belgilanganni chiqarish", icon: ICONS.unpack, onClick: () => extract(Array.from(selected)) },
      "spacer",
      { label: "Yopish", onClick: (a) => a.close(null) },
      { label: "Hammasini chiqarish", variant: "primary", default: true, onClick: () => extract([]) },
    ],
  });

  async function extract(only) {
    dlg.close(null);
    if (only.length) {
      const target = app.inactive().path;
      const jobId = api.newJobId();
      const prog = openProgress(jobId, "extract");
      try {
        await api.archiveExtract(jobId, path, target, only);
        prog.close();
        await app.inactive().reload();
        toast(`${only.length} ta yozuv chiqarildi`, { kind: "ok", title: "Chiqarildi" });
      } catch (err) {
        prog.close();
        toastError(err, "Chiqarib bo'lmadi");
      }
    } else {
      openUnpack(app, path);
    }
  }

  paint();
  return dlg.result;
}
