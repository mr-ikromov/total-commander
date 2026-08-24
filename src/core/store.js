import * as api from "./api.js";
import { emit } from "./bus.js";

export const DEFAULTS = {
  theme: "dark",
  showHidden: false,
  layout: "dual",
  dirsFirst: true,
  sortCaseSensitive: false,
  confirmDelete: true,
  deleteToTrash: true,
  defaultConflict: "ask",
  preserveTimes: true,
  doubleClickOpens: true,
  splitRatio: 0.5,
  columns: { date: 150 },
  rowHeight: 26,
  bookmarks: [],
  lastPaths: { left: "", right: "" },
  packLevel: 6,
  viewerWrap: false,
  editorLineEnding: "LF",
};

export const state = {
  settings: { ...DEFAULTS },
  sys: { os: "linux", sep: "/", home: "/", version: "1.0.0" },
  drives: [],
  activeSide: "left",
  clipboard: { mode: null, paths: [] },
};

let saveTimer = 0;

export async function initStore() {
  const [sys, saved, drives] = await Promise.all([
    api.systemInfo().catch(() => ({})),
    api.loadSettings().catch(() => ({})),
    api.getDrives().catch(() => []),
  ]);
  state.sys = {
    os: sys.os || "linux",
    arch: sys.arch || "",
    sep: sys.sep || "/",
    home: sys.home || "/",
    version: sys.version || "1.0.0",
  };
  state.drives = drives;
  state.settings = mergeDeep({ ...DEFAULTS }, saved || {});
  applyTheme(state.settings.theme);
  return state;
}

function mergeDeep(base, patch) {
  for (const [k, v] of Object.entries(patch || {})) {
    if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) {
      base[k] = mergeDeep({ ...base[k] }, v);
    } else if (v !== undefined) {
      base[k] = v;
    }
  }
  return base;
}

export function get(key) {
  return state.settings[key];
}

export function set(patch, { silent = false } = {}) {
  state.settings = mergeDeep({ ...state.settings }, patch);
  if (patch.theme) applyTheme(patch.theme);
  if (!silent) emit("settings:changed", state.settings);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    api.saveSettings(state.settings).catch((e) => console.warn("settings save failed", e));
  }, 400);
}

export function flushSettings() {
  clearTimeout(saveTimer);
  return api.saveSettings(state.settings).catch(() => {});
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

export async function refreshDrives() {
  state.drives = await api.getDrives().catch(() => []);
  emit("drives:changed", state.drives);
  return state.drives;
}

export function addBookmark(name, path) {
  const list = [...state.settings.bookmarks];
  if (!list.some((b) => b.path === path)) {
    list.push({ name: name || path, path });
    set({ bookmarks: list });
  }
  return list;
}

export function removeBookmark(path) {
  set({ bookmarks: state.settings.bookmarks.filter((b) => b.path !== path) });
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const collatorCase = new Intl.Collator(undefined, { numeric: true, sensitivity: "variant" });

const FIELD = {
  name: (e) => e.name,
  ext: (e) => e.ext,
  size: (e) => e.size,
  modified: (e) => e.modified,
  created: (e) => e.created,
  attrs: (e) => e.attrs,
};

export function sortEntries(entries, key = "name", dir = 1, opts = {}) {
  const dirsFirst = opts.dirsFirst ?? state.settings.dirsFirst;
  const cs = opts.caseSensitive ?? state.settings.sortCaseSensitive;
  const cmpText = cs ? collatorCase : collator;
  const pick = FIELD[key] || FIELD.name;
  return entries.slice().sort((a, b) => {
    if (a.fileName === "..") return -1;
    if (b.fileName === "..") return 1;
    if (dirsFirst && a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    const va = pick(a);
    const vb = pick(b);
    let r;
    if (typeof va === "number" && typeof vb === "number") r = va - vb;
    else r = cmpText.compare(String(va ?? ""), String(vb ?? ""));
    if (r === 0 && key !== "name") r = cmpText.compare(a.name, b.name);
    return r * dir;
  });
}

export function parentEntry(parentPath) {
  return {
    path: parentPath,
    name: "..",
    ext: "",
    fileName: "..",
    size: 0,
    modified: 0,
    created: 0,
    accessed: 0,
    isDir: true,
    isSymlink: false,
    isHidden: false,
    attrs: "----",
    perms: "",
    owner: "",
    linkTarget: null,
    isParent: true,
  };
}
