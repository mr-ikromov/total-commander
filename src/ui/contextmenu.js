import { openPopup } from "./popup.js";
import { state } from "../core/store.js";
import { prettyKey } from "./commands.js";

export function showFileContextMenu(app, { x, y, panel, entry }) {
  const hasEntry = !!entry && !entry.isParent;
  const many = panel.selection().length > 1;
  const items = hasEntry ? [
    { label: entry.isDir ? "Papkani ochish" : "Ochish", key: prettyKey("Enter"), onClick: () => panel.open(entry) },
    !entry.isDir && { label: "Ko'rish", key: prettyKey("F3"), onClick: () => app.run("view") },
    !entry.isDir && { label: "Tahrirlash", key: prettyKey("F4"), onClick: () => app.run("edit") },
    entry.isDir && { label: "Qarshi panelda ochish", onClick: () => app.run("openTabOther") },
    { label: "Nusxalash", key: prettyKey("F5"), onClick: () => app.run("copy") },
    { label: "Ko'chirish", key: prettyKey("F6"), onClick: () => app.run("move") },
    { label: many ? "Ommaviy nomlash…" : "Nomini o'zgartirish", key: prettyKey(many ? "ctrl+m" : "shift+F6"),
      onClick: () => app.run(many ? "multiRename" : "rename") },
    { label: "O'chirish", key: prettyKey("F8"), onClick: () => app.run("delete") },
    { label: "Buferga nusxalash", key: prettyKey("ctrl+c"), onClick: () => app.run("clipCopy") },
    { label: "Buferga kesish", key: prettyKey("ctrl+x"), onClick: () => app.run("clipCut") },
    { label: "Qo'yish", key: prettyKey("ctrl+v"), disabled: !state.clipboard.paths.length, onClick: () => app.run("clipPaste") },
    { label: "Arxivlash…", key: prettyKey("alt+F5"), onClick: () => app.run("pack") },
    { label: "Arxivdan chiqarish…", key: prettyKey("alt+F9"), onClick: () => app.run("unpack") },
    { label: "To'liq yo'ldan nusxa", key: prettyKey("ctrl+shift+p"), onClick: () => app.run("copyPath") },
    { label: "Joyni hisoblash", key: prettyKey("ctrl+l"), onClick: () => app.run("dirSize") },
    { label: "Xossalari", key: prettyKey("alt+Enter"), onClick: () => app.run("props") },
  ] : [
    { label: "Yangi papka", key: prettyKey("F7"), onClick: () => app.run("mkdir") },
    { label: "Yangi fayl", key: prettyKey("shift+F4"), onClick: () => app.run("mkfile") },
    { label: "Qo'yish", key: prettyKey("ctrl+v"), disabled: !state.clipboard.paths.length, onClick: () => app.run("clipPaste") },
    { label: "Hammasini belgilash", key: prettyKey("ctrl+a"), onClick: () => app.run("selectAll") },
    { label: "Belgilashni teskarilash", key: prettyKey("*"), onClick: () => app.run("invert") },
    { label: "Yangilash", key: prettyKey("ctrl+r"), onClick: () => app.run("reload") },
    { label: "Shu yerda terminal ochish", key: prettyKey("ctrl+shift+t"), onClick: () => app.run("terminal") },
    { label: "Tizim fayl menejerida ko'rsatish", onClick: () => app.run("revealOs") },
    { label: "Xatcho'plarga qo'shish", key: prettyKey("ctrl+d"), onClick: () => app.run("bookmarkAdd") },
    { label: "Papka xossalari", key: prettyKey("alt+Enter"), onClick: () => app.run("props") },
  ];
  openPopup(items.filter(Boolean), { x, y, className: "ctxmenu" });
}

export function showDriveMenu(app, side, anchor) {
  const panel = app.panels[side];
  const items = [];
  for (const d of state.drives) {
    const label = d.total
      ? `${d.label}  —  ${(d.total / 1024 ** 3).toFixed(1)} GB dan ${(d.free / 1024 ** 3).toFixed(1)} GB bo'sh`
      : d.label;
    items.push({ label, checked: panel.path.startsWith(d.path), onClick: () => panel.navigate(d.path) });
  }

  const bookmarks = app.settings.bookmarks;
  if (bookmarks.length) {
    for (const b of bookmarks) {
      items.push({ label: `★ ${b.name}`, onClick: () => panel.navigate(b.path) });
    }
  }

  const hist = panel.tab.history.slice().reverse().slice(0, 8);
  if (hist.length > 1) {
    for (const p of hist) items.push({ label: p, onClick: () => panel.navigate(p) });
  }

  items.push({ label: "Disklarni qayta skanerlash", onClick: () => app.run("refreshDrives") });
  openPopup(items, { anchor });
}
