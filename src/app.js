import { $, keyId, debounce } from "./core/dom.js";
import { state, get, set, initStore, flushSettings, refreshDrives } from "./core/store.js";
import { on } from "./core/bus.js";
import * as api from "./core/api.js";
import * as fmt from "./core/format.js";
import { Panel } from "./ui/panel.js";
import { buildCommands } from "./ui/commands.js";
import { renderHeaderActions, refreshToggles } from "./ui/chrome.js";
import { showFileContextMenu, showDriveMenu } from "./ui/contextmenu.js";
import { closePopup, isPopupOpen } from "./ui/popup.js";
import { toast, toastError } from "./ui/toast.js";
import { currentWindow, invoke } from "./core/tauri.js";

export class App {
  constructor() {
    this.el = $("#app");
    this.win = currentWindow();
    this.progressRef = { current: null };
    this.panels = {};
    this.commands = [];
    this._cmdIndex = new Map();
    this._keyIndex = new Map();
  }
  get sep() { return state.sys.sep; }
  get settings() { return state.settings; }
  get activeSide() { return state.activeSide; }
  active() { return this.panels[state.activeSide]; }
  inactive() { return this.panels[state.activeSide === "left" ? "right" : "left"]; }
  command(id) { return this._cmdIndex.get(id); }
  run(id) {
    const cmd = this._cmdIndex.get(id);
    if (!cmd) return;
    try {
      const r = cmd.run();
      if (r?.catch) r.catch((e) => toastError(e, cmd.label));
    } catch (e) {
      toastError(e, cmd.label);
    }
  }

  async start() {
    await initStore();
    this.panels.left = new Panel($("#pane-left"), "left");
    this.panels.right = new Panel($("#pane-right"), "right");
    this.commands = buildCommands(this);
    for (const c of this.commands) {
      this._cmdIndex.set(c.id, c);
      if (c.key) this._keyIndex.set(normalizeKey(c.key), c.id);
    }
    renderHeaderActions(this, $("#header-actions"));
    this._wireWindowButtons();
    this._wireSplitter();
    this._wireGlobalKeys();
    this._wireBusEvents();
    this._wireProgressStream();
    this.applyChrome();
    const last = get("lastPaths");
    const home = state.sys.home;
    await Promise.all([
      this.panels.left.navigate(await validPath(last.left) || home),
      this.panels.right.navigate(await validPath(last.right) || home),
    ]);
    this.setActive("left");
    this.panels.left.focus();
    window.addEventListener("beforeunload", () => flushSettings());
    setInterval(() => refreshDrives(), 30_000);
  }

  applyChrome() {
    const s = state.settings;
    this.el.dataset.layout = s.layout;
    this.el.dataset.active = state.activeSide;
    document.documentElement.dataset.theme = s.theme;
    this.el.style.setProperty("--split", `${(s.splitRatio * 100).toFixed(2)}%`);
    this.el.style.setProperty("--row-h-user", `${s.rowHeight}px`);
    refreshToggles(this, $("#header-actions"));
  }

  setActive(side) {
    state.activeSide = side;
    this.el.dataset.active = side;
    this.panels.left.setActiveStyle(side === "left");
    this.panels.right.setActiveStyle(side === "right");
  }

  toggleSide() {
    const next = state.activeSide === "left" ? "right" : "left";
    this.setActive(next);
    this.panels[next].focus();
  }

  swapPanels() {
    const a = this.panels.left.path;
    const b = this.panels.right.path;
    this.panels.left.navigate(b);
    this.panels.right.navigate(a);
  }

  showDrives(side) {
    const anchor = this.panels[side].driveBtn;
    showDriveMenu(this, side, anchor);
  }

  showVirtualListing(panel, hits, title) {
    panel.entries = hits.map((hit) => ({
      path: hit.path,
      name: fmt.baseName(hit.path).replace(/\.[^.]+$/, ""),
      ext: (fmt.baseName(hit.path).split(".").length > 1 ? fmt.baseName(hit.path).split(".").pop() : ""),
      fileName: fmt.baseName(hit.path),
      size: hit.size,
      modified: hit.modified,
      created: 0,
      accessed: 0,
      isDir: hit.isDir,
      isSymlink: false,
      isHidden: false,
      attrs: "----",
      perms: "",
      owner: "",
      linkTarget: null,
    }));
    panel._resort();
    panel.tab.cursor = 0;
    panel._scheduleRender();
    panel._renderStatus();
    toast(title, { kind: "ok", title: "Panelda qidiruv natijalari — tiklash uchun Ctrl+R" });
  }

  async toggleDevtools() {
    try {
      await invoke("plugin:webview|internal_toggle_devtools");
    } catch {
      toast("Dasturchi vositalari faqat debug qurilmasida mavjud", { kind: "warn" });
    }
  }

  async closeWindow() {
    await flushSettings();
    this.win.close();
  }

  _wireWindowButtons() {
    for (const btn of document.querySelectorAll("[data-win]")) {
      btn.addEventListener("click", () => {
        const act = btn.dataset.win;
        if (act === "minimize") this.win.minimize();
        else if (act === "maximize") this.win.toggleMaximize();
        else if (act === "close") this.closeWindow();
      });
    }
    $(".titlebar").addEventListener("dblclick", (e) => {
      if (e.target.closest("button")) return;
      this.win.toggleMaximize().then(() => this._syncMaximized());
    });
    for (const grip of document.querySelectorAll("[data-resize]")) {
      grip.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        this.win.startResizeDragging(grip.dataset.resize).catch(() => {});
      });
    }
    this.win.onResized(() => this._syncMaximized()).catch(() => {});
    this._syncMaximized();
  }

  async _syncMaximized() {
    try {
      this.el.dataset.maximized = (await this.win.isMaximized()) ? "1" : "0";
    } catch {
      this.el.dataset.maximized = "0";
    }
  }

  _wireSplitter() {
    const splitter = $("#splitter");
    const workspace = $("#workspace");
    const startDrag = (clientX) => {
      splitter.dataset.dragging = "1";
      const rect = workspace.getBoundingClientRect();
      const move = (x) => {
        const ratio = Math.min(0.85, Math.max(0.15, (x - rect.left) / rect.width));
        this.el.style.setProperty("--split", `${(ratio * 100).toFixed(2)}%`);
        return ratio;
      };
      let ratio = get("splitRatio");
      const onMove = (e) => { ratio = move(e.clientX ?? e.touches?.[0]?.clientX ?? 0); };
      const onUp = () => {
        delete splitter.dataset.dragging;
        set({ splitRatio: ratio });
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.addEventListener("touchmove", onMove, { passive: true });
      document.addEventListener("touchend", onUp);
      move(clientX);
    };
    splitter.addEventListener("mousedown", (e) => { e.preventDefault(); startDrag(e.clientX); });
    splitter.addEventListener("touchstart", (e) => startDrag(e.touches[0].clientX), { passive: true });
    splitter.addEventListener("dblclick", () => { set({ splitRatio: 0.5 }); this.applyChrome(); });
    splitter.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 0.05 : 0.01;
      if (e.key === "ArrowLeft") { set({ splitRatio: Math.max(0.15, get("splitRatio") - step) }); this.applyChrome(); }
      if (e.key === "ArrowRight") { set({ splitRatio: Math.min(0.85, get("splitRatio") + step) }); this.applyChrome(); }
    });
  }

  _wireGlobalKeys() {
    document.addEventListener("keydown", (e) => {
      const inField = isEditable(e.target);
      const inDialog = !!e.target.closest?.(".dlg");
      if (inDialog) return;
      if (e.key === "Escape" && isPopupOpen()) { closePopup(); return; }
      const id = keyId(e);
      const bare = e.shiftKey && !/^shift\+[A-Za-z]/.test(id) && id.length <= 8 ? id.replace("shift+", "") : id;
      if (e.target.closest?.(".rows") && (PANEL_OWNED.has(id) || PANEL_OWNED.has(bare))) return;
      const cmdId = this._keyIndex.get(id) || this._keyIndex.get(bare);
      if (id === "Tab" && !inField) { e.preventDefault(); this.toggleSide(); return; }
      if (inField) return;
      if (cmdId) {
        e.preventDefault();
        this.run(cmdId);
        return;
      }
      if (id === "alt+F2") { e.preventDefault(); this.showDrives("right"); }
    }, true);

  }

  _wireBusEvents() {
    on("panel:activated", (side) => this.setActive(side));
    on("panel:drives", ({ side, anchor }) => showDriveMenu(this, side, anchor));
    on("panel:context", ({ side, x, y, index }) => {
      const panel = this.panels[side];
      this.setActive(side);
      showFileContextMenu(this, { x, y, panel, entry: index >= 0 ? panel.view[index] : null });
    });
    on("panel:selectMask", ({ on: mark }) => this.run(mark ? "selectMask" : "unselectMask"));
    on("archive:open", async ({ path }) => {
      const { browseArchive } = await import("./ui/packer.js");
      browseArchive(this, path);
    });
    on("columns:changed", () => {
      this.panels.left._applyColumnWidths();
      this.panels.right._applyColumnWidths();
    });
    on("settings:changed", debounce(() => {
      document.documentElement.dataset.theme = get("theme");
      refreshToggles(this, $("#header-actions"));
    }, 60));
    on("drives:changed", () => { this.panels.left._renderDrive(); this.panels.right._renderDrive(); });
  }
  async _wireProgressStream() {
    await api.onProgress((ev) => {
      this.progressRef.current?.update(ev);
    });
  }
}

const PANEL_OWNED = new Set([
  "Enter", "Backspace", "Space", "Insert", "ctrl+a", "*", "+", "-",
  "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", "Escape",
]);

function isEditable(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function normalizeKey(key) {
  const parts = key.split("+");
  const mods = [];
  let main = parts[parts.length - 1];
  for (const p of parts.slice(0, -1)) {
    const m = p.toLowerCase();
    if (m === "ctrl" || m === "cmd" || m === "meta") mods.push("ctrl");
    else if (m === "alt") mods.push("alt");
    else if (m === "shift") mods.push("shift");
  }
  const order = ["ctrl", "alt", "shift"].filter((m) => mods.includes(m));
  if (main === "comma") main = ",";
  if (main === "Backslash") main = "\\";
  if (main.length === 1) main = main.toLowerCase();
  return [...order, main].join("+");
}

async function validPath(p) {
  if (!p) return null;
  return (await api.pathExists(p).catch(() => false)) ? p : null;
}
