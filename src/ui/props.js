import { h, svg } from "../core/dom.js";
import { openDialog, promptDialog } from "./dialog.js";
import { ICONS } from "../core/icons.js";
import { toast, toastError } from "./toast.js";
import * as api from "../core/api.js";
import * as fmt from "../core/format.js";

export async function openProperties(app) {
  const panel = app.active();
  const items = panel.selection();
  if (!items.length) return toast("Hech narsa belgilanmagan", { kind: "warn" });
  const multi = items.length > 1;
  const first = items[0];
  const sizeEl = h("dd", { text: multi || first.isDir ? "hisoblanmoqda…" : fmt.fullBytes(first.size) });
  const countEl = h("dd", { text: "—" });
  const hashEl = h("dd", { text: "—" });
  const dl = h("dl", { class: "kv" },
    h("dt", { text: "Nomi" }), h("dd", { text: multi ? `${items.length} ta element` : first.fileName }),
    h("dt", { text: "Joylashuvi" }), h("dd", { text: panel.path }),
    h("dt", { text: "Turi" }), h("dd", { text: multi ? "Bir nechta" : first.isDir ? "Papka" : (first.ext ? `${first.ext.toUpperCase()} fayl` : "Fayl") }),
    h("dt", { text: "Hajmi" }), sizeEl,
    h("dt", { text: "Tarkibi" }), countEl,
    h("dt", { text: "O'zgartirilgan" }), h("dd", { text: multi ? "—" : fmt.stampFull(first.modified) }),
    h("dt", { text: "Yaratilgan" }), h("dd", { text: multi ? "—" : fmt.stampFull(first.created) }),
    h("dt", { text: "Ochilgan" }), h("dd", { text: multi ? "—" : fmt.stampFull(first.accessed) }),
    h("dt", { text: "Atributlar" }), h("dd", { text: multi ? "—" : `${first.attrs}${first.perms ? `  ${first.perms}` : ""}` }),
    h("dt", { text: "Egasi" }), h("dd", { text: first.owner || "—" }),
    first.linkTarget ? h("dt", { text: "Havola nishoni" }) : null,
    first.linkTarget ? h("dd", { text: first.linkTarget }) : null,
    h("dt", { text: "Nazorat yig'indisi" }), hashEl,
  );

  const algoSel = h("select", { class: "select", style: { width: "auto" } }, ...["md5", "sha256", "sha512", "crc32"].map((a) => h("option", { value: a, text: a.toUpperCase() })));
  const body = h("div", {}, dl,
    h("div", { class: "inline", style: { marginTop: "14px" } },
      algoSel,
      h("button", {
        class: "btn", type: "button",
        on: { click: () => computeHash(algoSel.value) },
      }, svg(ICONS.hash), "Nazorat yig'indisini hisoblash")),
  );

  const dlg = openDialog({
    title: "Xossalari",
    icon: ICONS.props,
    size: "md",
    body,
    buttons: ["spacer", { label: "Yopish", variant: "primary", default: true, onClick: (a) => a.close(null) }],
  });

  (async () => {
    let bytes = 0, files = 0, dirs = 0;
    for (const it of items) {
      if (it.isDir) {
        const s = await api.dirStats(it.path).catch(() => null);
        if (s) { bytes += s.bytes; files += s.files; dirs += s.dirs + 1; }
      } else { bytes += it.size; files++; }
    }
    sizeEl.textContent = `${fmt.fullBytes(bytes)}  (${fmt.shortSize(bytes)})`;
    countEl.textContent = `${files} ta fayl, ${dirs} ta papka`;
  })();

  async function computeHash(algo) {
    if (multi || first.isDir) return toast("Bitta fayl tanlang", { kind: "warn" });
    hashEl.textContent = "hisoblanmoqda…";
    try {
      hashEl.textContent = await api.fileChecksum(first.path, algo);
    } catch (err) {
      hashEl.textContent = "—";
      toastError(err, "Yig'indini hisoblab bo'lmadi");
    }
  }
  return dlg.result;
}

export async function compareByContent(app) {
  const a = app.panels.left.cursorEntry;
  const b = app.panels.right.cursorEntry;
  if (!a || !b || a.isDir || b.isDir) return toast("Ikkala panelda ham kursorni faylga qo'ying", { kind: "warn" });
  try {
    const same = await api.compareFiles(a.path, b.path);
    toast(same ? "Fayllar bir xil" : "Fayllar farq qiladi", { kind: same ? "ok" : "warn", title: "Mazmuni bo'yicha solishtirish" });
  } catch (err) {
    toastError(err, "Solishtirib bo'lmadi");
  }
}

export async function openSplit(app) {
  const panel = app.active();
  const entry = panel.cursorEntry;
  if (!entry || entry.isDir) return toast("Bo'laklash uchun fayl tanlang", { kind: "warn" });
  const sizeInput = h("input", { class: "input input--mono", type: "text", value: "10M" });
  const dirInput = h("input", { class: "input input--mono", type: "text", value: app.inactive().path });
  const body = h("div", {},
    h("p", { text: `“${entry.fileName}” bo'laklanmoqda (${fmt.shortSize(entry.size)})` }),
    h("div", { class: "field" }, h("label", { text: "Bo'lak hajmi (masalan 700k, 10M, 4G)" }), sizeInput),
    h("div", { class: "field" }, h("label", { text: "Nishon papka" }), dirInput),
  );
  const dlg = openDialog({
    title: "Faylni bo'laklash", icon: ICONS.split, size: "sm", body,
    buttons: ["spacer",
      { label: "Bekor qilish", onClick: (a) => a.close(null) },
      { label: "Bo'laklash", variant: "primary", default: true, onClick: (a) => a.close(true) }],
  });
  if (!(await dlg.result)) return;
  const partSize = fmt.parseSize(sizeInput.value);
  if (!partSize) return toast("Yaroqsiz bo'lak hajmi", { kind: "error" });
  try {
    const parts = await api.splitFile(entry.path, dirInput.value.trim(), partSize);
    await app.inactive().reload();
    toast(`${parts.length - 1} ta bo'lak + nazorat fayli yozildi`, { kind: "ok", title: "Bo'laklandi" });
  } catch (err) {
    toastError(err, "Bo'laklab bo'lmadi");
  }
}

export async function openCombine(app) {
  const panel = app.active();
  const entry = panel.cursorEntry;
  if (!entry || entry.isDir) return toast("Birinchi bo'lakni tanlang (.001)", { kind: "warn" });
  const target = await promptDialog({
    title: "Bo'laklarni birlashtirish",
    icon: ICONS.pack,
    label: "Natija fayli",
    value: `${app.inactive().path}${app.sep}${entry.name}`,
    okLabel: "Birlashtirish",
  });
  if (!target) return;
  try {
    const bytes = await api.combineFiles(entry.path, target);
    await app.inactive().reload();
    toast(`${fmt.shortSize(bytes)} yozildi`, { kind: "ok", title: "Birlashtirildi" });
  } catch (err) {
    toastError(err, "Birlashtirib bo'lmadi");
  }
}
