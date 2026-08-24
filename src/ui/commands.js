import { ICONS } from "../core/icons.js";
import { get, set, addBookmark, removeBookmark, state, refreshDrives } from "../core/store.js";
import { toast } from "./toast.js";
import { openDialog, confirmDialog, promptDialog } from "./dialog.js";
import { h } from "../core/dom.js";
import { openProgress } from "./progress.js";
import * as api from "../core/api.js";
import * as fmt from "../core/format.js";

const KEY_LABEL = {
  comma: ",", Backslash: "\\", ArrowLeft: "←", ArrowRight: "→",
  ArrowUp: "↑", ArrowDown: "↓", Backspace: "Backspace", Enter: "Enter",
  Delete: "Del", Escape: "Esc", Tab: "Tab", Space: "Space",
};

export function prettyKey(key) {
  if (!key) return "";
  const mac = state.sys.os === "macos";
  return key.split("+").map((part) => {
    const p = part.toLowerCase();
    if (p === "ctrl") return mac ? "\u2318" : "Ctrl";
    if (p === "alt") return mac ? "\u2325" : "Alt";
    if (p === "shift") return mac ? "\u21e7" : "Shift";
    if (KEY_LABEL[part]) return KEY_LABEL[part];
    return part.length === 1 ? part.toUpperCase() : part;
  }).join(mac ? "" : "+");
}

export function buildCommands(app) {
  const A = () => app.active();
  const B = () => app.inactive();
  const lazy = (mod, fn) => async (...args) => {
    const m = await import(mod);
    return m[fn](app, ...args);
  };

  const cmds = [
    { id: "view", label: "Ko'rish", key: "F3", icon: ICONS.view, group: "Fayllar",
      run: async () => {
        const e = A().cursorEntry;
        if (!e || e.isDir) return toast("Ko'rish uchun fayl tanlang", { kind: "warn" });
        const { openViewer } = await import("./viewer.js");
        openViewer(e.path);
      } },
    { id: "edit", label: "Tahrirlash", key: "F4", icon: ICONS.edit, group: "Fayllar",
      run: async () => {
        const e = A().cursorEntry;
        if (!e || e.isDir) return toast("Tahrirlash uchun fayl tanlang", { kind: "warn" });
        const { openEditor } = await import("./editor.js");
        openEditor(e.path, () => A().reload());
      } },
    { id: "copy", label: "Nusxalash", key: "F5", icon: ICONS.copy, group: "Fayllar",
      run: lazy("./ops.js", "transfer").bind(null, "copy") },
    { id: "move", label: "Ko'chirish", key: "F6", icon: ICONS.move, group: "Fayllar",
      run: lazy("./ops.js", "transfer").bind(null, "move") },
    { id: "mkdir", label: "Yangi papka", key: "F7", icon: ICONS.newFolder, group: "Fayllar",
      run: lazy("./ops.js", "makeDir") },
    { id: "mkfile", label: "Yangi fayl", key: "shift+F4", icon: ICONS.file, group: "Fayllar",
      run: lazy("./ops.js", "makeFile") },
    { id: "delete", label: "O'chirish", key: "F8", icon: ICONS.trash, group: "Fayllar", danger: true,
      run: lazy("./ops.js", "remove") },
    { id: "deleteHard", label: "Butunlay o'chirish", key: "shift+Delete", icon: ICONS.trash, group: "Fayllar", danger: true,
      run: () => import("./ops.js").then((m) => m.remove(app, { toTrash: false })) },
    { id: "rename", label: "Nomini o'zgartirish", key: "shift+F6", icon: ICONS.rename, group: "Fayllar",
      run: lazy("./ops.js", "renameInPlace") },
    { id: "multiRename", label: "Ommaviy nom o'zgartirish", key: "ctrl+m", icon: ICONS.rename, group: "Fayllar",
      run: lazy("./multirename.js", "openMultiRename") },
    { id: "props", label: "Xossalari", key: "alt+Enter", icon: ICONS.props, group: "Fayllar",
      run: lazy("./props.js", "openProperties") },
    { id: "open", label: "Ochish", key: "Enter", icon: ICONS.chevronRight, group: "Fayllar",
      run: () => A().open() },
    { id: "openWith", label: "Tizim dasturida ochish", key: "shift+Enter", icon: ICONS.chevronRight, group: "Fayllar",
      run: async () => {
        const e = A().cursorEntry;
        if (!e) return;
        try { await api.openPath(e.path); } catch (err) { toast(String(err), { kind: "error" }); }
      } },
    { id: "revealOs", label: "Tizim fayl menejerida ko'rsatish", icon: ICONS.folder, group: "Fayllar",
      run: () => api.revealInManager(A().path).catch((e) => toast(String(e), { kind: "error" })) },
    { id: "selectAll", label: "Hammasini belgilash", key: "ctrl+a", icon: ICONS.select, group: "Belgilash",
      run: () => A().selectAll(true) },
    { id: "selectNone", label: "Belgilashni bekor qilish", key: "ctrl+shift+a", icon: ICONS.x, group: "Belgilash",
      run: () => A().selectAll(false) },
    { id: "invert", label: "Belgilashni teskarilash", key: "*", icon: ICONS.invert, group: "Belgilash",
      run: () => A().invertSelection() },
    { id: "selectMask", label: "Niqob bo'yicha belgilash…", key: "+", icon: ICONS.filter, group: "Belgilash",
      run: () => maskDialog(true) },
    { id: "unselectMask", label: "Niqob bo'yicha bekor qilish…", key: "-", icon: ICONS.filter, group: "Belgilash",
      run: () => maskDialog(false) },
    { id: "selectSameExt", label: "Bir xil kengaytmalilarni belgilash", icon: ICONS.select, group: "Belgilash",
      run: () => A().selectSameExt(true) },
    { id: "reload", label: "Panelni yangilash", key: "ctrl+r", icon: ICONS.refresh, group: "Harakat",
      run: () => A().reload() },
    { id: "reloadBoth", label: "Ikkala panelni yangilash", key: "F2", icon: ICONS.reload, group: "Harakat",
      run: () => { app.panels.left.reload(); app.panels.right.reload(); } },
    { id: "parent", label: "Yuqoridagi papka", key: "Backspace", icon: ICONS.up, group: "Harakat",
      run: () => A().goParent() },
    { id: "root", label: "Ildiz papka", key: "ctrl+Backslash", icon: ICONS.home, group: "Harakat",
      run: () => A().navigate(app.sep === "\\" ? A().path.slice(0, 3) : "/") },
    { id: "home", label: "Uy papkasi", key: "ctrl+Home", icon: ICONS.home, group: "Harakat",
      run: () => A().navigate(state.sys.home) },
    { id: "back", label: "Orqaga", key: "alt+ArrowLeft", icon: ICONS.chevronLeft, group: "Harakat",
      run: () => A().goBack() },
    { id: "forward", label: "Oldinga", key: "alt+ArrowRight", icon: ICONS.chevronRight, group: "Harakat",
      run: () => A().goForward() },
    { id: "editPath", label: "Yo'lni yozish…", key: "ctrl+p", icon: ICONS.edit, group: "Harakat",
      run: () => A().editPath() },
    { id: "quickFilter", label: "Tezkor filtr", key: "ctrl+f", icon: ICONS.filter, group: "Harakat",
      run: () => A().openFilter() },
    { id: "swapPanels", label: "Panellarni almashtirish", key: "ctrl+u", icon: ICONS.swap, group: "Harakat",
      run: () => app.swapPanels() },
    { id: "sameLeft", label: "Nishon = manba", key: "ctrl+ArrowRight", icon: ICONS.equal, group: "Harakat",
      run: () => B().navigate(A().path) },
    { id: "otherSide", label: "Panelni almashtirish", key: "Tab", icon: ICONS.columns, group: "Harakat",
      run: () => app.toggleSide() },
    { id: "newTab", label: "Yangi varaq", key: "ctrl+t", icon: ICONS.plus, group: "Harakat",
      run: () => A().addTab(A().path) },
    { id: "closeTab", label: "Varaqni yopish", key: "ctrl+w", icon: ICONS.x, group: "Harakat",
      run: () => A().closeTab() },
    { id: "nextTab", label: "Keyingi varaq", key: "ctrl+Tab", icon: ICONS.chevronRight, group: "Harakat",
      run: () => A().nextTab(1) },
    { id: "lockTab", label: "Varaqni qulflash", key: "ctrl+shift+l", icon: ICONS.lock, group: "Harakat",
      run: () => A().toggleTabLock() },
    { id: "openTabOther", label: "Papkani qarshi panelda ochish", key: "ctrl+shift+Enter", icon: ICONS.columns, group: "Harakat",
      run: () => { const e = A().cursorEntry; if (e?.isDir) B().navigate(e.path); } },
    { id: "find", label: "Fayllarni qidirish…", key: "alt+F7", icon: ICONS.search, group: "Vositalar",
      run: lazy("./search.js", "openSearch") },
    { id: "pack", label: "Arxivlash…", key: "alt+F5", icon: ICONS.pack, group: "Vositalar",
      run: lazy("./packer.js", "openPack") },
    { id: "unpack", label: "Arxivdan chiqarish…", key: "alt+F9", icon: ICONS.unpack, group: "Vositalar",
      run: lazy("./packer.js", "openUnpack") },
    { id: "compareDirs", label: "Papkalarni sinxronlash…", key: "ctrl+shift+s", icon: ICONS.sync, group: "Vositalar",
      run: lazy("./comparedirs.js", "openCompareDirs") },
    { id: "compareFiles", label: "Mazmuni bo'yicha solishtirish", key: "ctrl+shift+c", icon: ICONS.compare, group: "Vositalar",
      run: lazy("./props.js", "compareByContent") },
    { id: "split", label: "Faylni bo'laklash…", icon: ICONS.split, group: "Vositalar",
      run: lazy("./props.js", "openSplit") },
    { id: "combine", label: "Bo'laklarni birlashtirish…", icon: ICONS.pack, group: "Vositalar",
      run: lazy("./props.js", "openCombine") },
    { id: "dirSize", label: "Egallangan joyni hisoblash", key: "ctrl+l", icon: ICONS.info, group: "Vositalar",
      run: async () => {
        const items = A().selection();
        if (!items.length) return;
        let bytes = 0, files = 0, dirs = 0;
        for (const it of items) {
          if (it.isDir) { const s = await api.dirStats(it.path); bytes += s.bytes; files += s.files; dirs += s.dirs + 1; }
          else { bytes += it.size; files++; }
        }
        toast(`${fmt.fullBytes(bytes)} — ${files} ta fayl, ${dirs} ta papka`, { kind: "ok", title: "Egallangan joy" });
      } },
    { id: "terminal", label: "Shu yerda terminal ochish", key: "ctrl+shift+t", icon: ICONS.terminal, group: "Vositalar",
      run: () => api.openTerminal(A().path).catch((e) => toast(String(e), { kind: "error" })) },
    { id: "copyPath", label: "To'liq yo'ldan nusxa olish", key: "ctrl+shift+p", icon: ICONS.copy, group: "Vositalar",
      run: async () => {
        const e = A().cursorEntry;
        const text = e ? e.path : A().path;
        try {
          await api.clipboardWrite(text);
          toast(text, { kind: "ok", title: "Buferga nusxalandi" });
        } catch (err) { toast(String(err), { kind: "error", title: "Bufer ishlamadi" }); }
      } },
    { id: "copyNames", label: "Belgilangan nomlardan nusxa olish", key: "ctrl+shift+n", icon: ICONS.copy, group: "Vositalar",
      run: async () => {
        const text = A().selection().map((e) => e.fileName).join("\n");
        if (!text) return;
        try {
          await api.clipboardWrite(text);
          toast(`${A().selection().length} ta nom nusxalandi`, { kind: "ok" });
        } catch (err) { toast(String(err), { kind: "error", title: "Bufer ishlamadi" }); }
      } },

    { id: "clipCopy", label: "Buferga nusxalash", key: "ctrl+c", icon: ICONS.copy, group: "Almashish buferi",
      run: () => {
        const items = A().selection();
        if (!items.length) return;
        state.clipboard = { mode: "copy", paths: items.map((i) => i.path) };
        toast(`${items.length} ta element qo'yishga tayyor`, { kind: "ok", title: "Nusxalash" });
      } },
    { id: "clipCut", label: "Buferga kesish", key: "ctrl+x", icon: ICONS.cut, group: "Almashish buferi",
      run: () => {
        const items = A().selection();
        if (!items.length) return;
        state.clipboard = { mode: "cut", paths: items.map((i) => i.path) };
        toast(`${items.length} ta element ko'chirishga tayyor`, { kind: "ok", title: "Kesish" });
      } },
    { id: "clipPaste", label: "Qo'yish", key: "ctrl+v", icon: ICONS.paste, group: "Almashish buferi",
      run: async () => {
        const { mode, paths } = state.clipboard;
        if (!mode || !paths.length) return toast("Bufer bo'sh", { kind: "warn" });
        const req = api.makeOpRequest(paths, A().path, { conflict: "rename" });
        const prog = openProgress(req.jobId, mode === "cut" ? "move" : "copy");
        try {
          await (mode === "cut" ? api.moveItems(req) : api.copyItems(req));
          prog.close();
          if (mode === "cut") state.clipboard = { mode: null, paths: [] };
          await Promise.all([app.panels.left.reload(), app.panels.right.reload()]);
          toast(`${paths.length} ta element qo'yildi`, { kind: "ok" });
        } catch (err) { prog.close(); toast(String(err), { kind: "error", title: "Qo'yib bo'lmadi" }); }
      } },

    { id: "bookmarkAdd", label: "Joriy papkani xatcho'plarga qo'shish", key: "ctrl+d", icon: ICONS.star, group: "Xatcho'plar",
      run: async () => {
        const name = await promptDialog({
          title: "Xatcho'p qo'shish", label: "Nomi", value: fmt.baseName(A().path) || A().path, okLabel: "Qo'shish",
        });
        if (!name) return;
        addBookmark(name, A().path);
        toast(name, { kind: "ok", title: "Xatcho'p qo'shildi" });
      } },
    { id: "bookmarkManage", label: "Xatcho'plarni boshqarish…", icon: ICONS.bookmark, group: "Xatcho'plar",
      run: async () => {
        const list = get("bookmarks");
        if (!list.length) return toast("Hali xatcho'p yo'q", { kind: "warn" });
        const target = await pickFromList(list.map((b) => ({ label: `${b.name} — ${b.path}`, value: b.path })), "Xatcho'plar");
        if (!target) return;
        const remove = await confirmDialog({
          title: "Xatcho'p", message: target, okLabel: "O'tish", cancelLabel: "O'chirish",
        });
        if (remove) A().navigate(target);
        else { removeBookmark(target); toast("Xatcho'p o'chirildi", { kind: "ok" }); }
      } },

    { id: "toggleHidden", label: "Yashirin fayllarni ko'rsatish", key: "ctrl+h", icon: ICONS.eye, group: "Ko'rinish",
      checked: () => get("showHidden"),
      run: () => {
        set({ showHidden: !get("showHidden") });
        app.panels.left.reload();
        app.panels.right.reload();
      } },
    { id: "toggleLayout", label: "Bitta panel rejimi", key: "ctrl+shift+o", icon: ICONS.single, group: "Ko'rinish",
      checked: () => get("layout") === "single",
      run: () => { set({ layout: get("layout") === "single" ? "dual" : "single" }); app.applyChrome(); } },
    { id: "themeToggle", label: "Yorug' / qorong'i mavzu", key: "ctrl+shift+d", icon: ICONS.moon, group: "Ko'rinish",
      run: () => { set({ theme: get("theme") === "dark" ? "light" : "dark" }); } },
    { id: "sortName", label: "Nomi bo'yicha saralash", key: "ctrl+F3", icon: ICONS.select, group: "Ko'rinish",
      run: () => A().sortBy("name") },
    { id: "sortExt", label: "Kengaytma bo'yicha saralash", key: "ctrl+F4", icon: ICONS.select, group: "Ko'rinish",
      run: () => A().sortBy("ext") },
    { id: "sortDate", label: "Sana bo'yicha saralash", key: "ctrl+F5", icon: ICONS.select, group: "Ko'rinish",
      run: () => A().sortBy("modified") },
    { id: "drives", label: "Diskni almashtirish…", key: "alt+F1", icon: ICONS.drive, group: "Ko'rinish",
      run: () => app.showDrives(app.activeSide) },
    { id: "settings", label: "Sozlamalar…", key: "ctrl+comma", icon: ICONS.cog, group: "Dastur",
      run: () => import("./settings.js").then((m) => m.openSettings(app)) },
    { id: "shortcuts", label: "Klaviatura yorliqlari", key: "F1", icon: ICONS.info, group: "Dastur",
      run: () => import("./settings.js").then((m) => m.openShortcuts(app.commands)) },
    { id: "refreshDrives", label: "Disklarni qayta skanerlash", icon: ICONS.drive, group: "Dastur",
      run: async () => { await refreshDrives(); toast(`${state.drives.length} ta disk`, { kind: "ok" }); } },
    { id: "devtools", label: "Dasturchi vositalari", key: "F12", icon: ICONS.terminal, group: "Dastur",
      run: () => app.toggleDevtools() },
    { id: "exit", label: "Chiqish", key: "alt+F4", icon: ICONS.x, group: "Dastur",
      run: () => app.closeWindow() },
  ];

  async function maskDialog(on) {
    const mask = await promptDialog({
      title: on ? "Niqob bo'yicha belgilash" : "Niqob bo'yicha bekor qilish",
      label: "Niqob (masalan *.txt;*.md)",
      value: "*.*",
      okLabel: on ? "Belgilash" : "Bekor qilish",
    });
    if (!mask) return;
    const n = A().selectByMask(mask, on);
    toast(`${n} ta element ${on ? "belgilandi" : "bekor qilindi"}`, { kind: "ok" });
  }

  function pickFromList(options, title) {
    let chosen = null;
    const list = h("div", { class: "hit-list" },
      ...options.map((o) => h("button", {
        class: "menu-item", type: "button", text: o.label,
        on: { click: () => { chosen = o.value; dlg.close(o.value); } },
      })));
    const dlg = openDialog({
      title, icon: ICONS.bookmark, size: "sm", body: list,
      buttons: ["spacer", { label: "Bekor qilish", onClick: (a) => a.close(null) }],
    });
    return dlg.result.then(() => chosen);
  }
  return cmds;
}

export const MENUS = [
  { label: "Fayllar", items: [
    "view", "edit", "copy", "move", "rename", "multiRename",
    "mkdir", "mkfile", "delete", "deleteHard",
    "pack", "unpack", "props", "exit",
  ] },
  { label: "Belgilash", items: [
    "selectAll", "selectNone", "invert",
    "selectMask", "unselectMask", "selectSameExt",
    "dirSize", "compareFiles",
  ] },
  { label: "Buyruqlar", items: [
    "find", "compareDirs", "swapPanels", "sameLeft", "otherSide",
    "newTab", "closeTab", "lockTab", "openTabOther",
    "terminal", "revealOs", "split", "combine",
  ] },
  { label: "Bufer", items: [
    "copyPath", "copyNames", "clipCopy", "clipCut", "clipPaste",
  ] },
  { label: "Ko'rinish", items: [
    "toggleHidden", "toggleLayout",
    "sortName", "sortExt", "sortDate",
    "themeToggle", "reload", "reloadBoth",
  ] },
  { label: "Sozlamalar", items: [
    "settings", "shortcuts", "bookmarkAdd", "bookmarkManage",
    "refreshDrives", "devtools",
  ] },
];
export const HEADER_ACTIONS = ["toggleHidden", "settings"];
