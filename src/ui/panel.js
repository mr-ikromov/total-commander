import { h, clear, svg, debounce } from "../core/dom.js";
import { ICONS, fileIconNode } from "../core/icons.js";
import * as fmt from "../core/format.js";
import * as api from "../core/api.js";
import { state, get, set, sortEntries, parentEntry } from "../core/store.js";
import { emit } from "../core/bus.js";
import { toast } from "./toast.js";

const OVERSCAN = 8;
let tabSeq = 0;

const COLUMNS = [
  { key: "name", label: "Nomi", num: false },
  { key: "modified", label: "Sana", num: false },
];

function newTab(path) {
  return {
    id: `t${++tabSeq}`,
    path,
    locked: false,
    sortKey: "name",
    sortDir: 1,
    selected: new Set(),
    cursor: 0,
    filter: "",
    history: path ? [path] : [],
    hIdx: 0,
    scrollTop: 0,
  };
}

export class Panel {
  constructor(root, side) {
    this.root = root;
    this.side = side;
    this.tabs = [newTab("")];
    this.tabIdx = 0;
    this.entries = [];
    this.view = [];
    this.listing = null;
    this.rowH = get("rowHeight");
    this.quick = { text: "", timer: 0 };
    this.loading = false;
    this._build();
  }

  get tab() { return this.tabs[this.tabIdx]; }
  get path() { return this.tab.path; }
  get isActive() { return state.activeSide === this.side; }
  get cursorEntry() { return this.view[this.tab.cursor] || null; }

  selection() {
    const marked = this.view.filter((e) => !e.isParent && this.tab.selected.has(e.path));
    if (marked.length) return marked;
    const c = this.cursorEntry;
    return c && !c.isParent ? [c] : [];
  }

  _build() {
    const root = clear(this.root);
    root.dataset.active = this.isActive ? "1" : "0";
    root.dataset.filter = "0";

    this.driveLabel = h("span", { class: "drive-select__label", text: "…" });
    this.driveBtn = h("button", {
      class: "drive-select",
      type: "button",
      title: "Diskni almashtirish (Alt+F1 / Alt+F2)",
      on: { click: (e) => emit("panel:drives", { side: this.side, anchor: e.currentTarget }) },
    }, svg(ICONS.drive), this.driveLabel, svg(ICONS.chevronDown));
    this.driveBtn.lastElementChild.classList.add("drive-select__caret");
    this.freeText = h("span", { class: "drivebar__free", text: "" });
    const tools = h("div", { class: "drivebar__tools" },
      this._iconBtn(ICONS.up, "Yuqoridagi papka (Backspace)", () => this.goParent()),
      this._iconBtn(ICONS.home, "Uy papkasi", () => this.navigate(state.sys.home)),
      this._iconBtn(ICONS.refresh, "Yangilash (Ctrl+R)", () => this.reload()),
      this._iconBtn(ICONS.plus, "Yangi varaq (Ctrl+T)", () => this.addTab(this.path)),
    );
    this.driveBar = h("div", { class: "drivebar" }, this.driveBtn, this.freeText, tools);
    this.tabsEl = h("div", { class: "pane__tabs" });
    this.crumbEl = h("div", {
      class: "crumb",
      on: { dblclick: () => this.editPath() },
      title: "Yo'lni yozish uchun ikki marta bosing",
    });
    this.colsEl = h("div", { class: "cols" });
    this._renderCols();
    this.viewEl = h("div", { class: "rows__view" });
    this.sizerEl = h("div", { class: "rows__sizer" }, this.viewEl);
    this.rowsEl = h("div", {
      class: "rows",
      tabindex: "0",
      role: "listbox",
      "aria-label": `${this.side === "left" ? "Chap" : "O'ng"} panel fayllar ro'yxati`,
      on: {
        scroll: () => this._onScroll(),
        keydown: (e) => this._onKey(e),
        mousedown: (e) => this._onMouseDown(e),
        dblclick: (e) => this._onDblClick(e),
        contextmenu: (e) => this._onContext(e),
        focus: () => this.activate(),
      },
    }, this.sizerEl);

    this.filterInput = h("input", {
      type: "text",
      placeholder: "Filtr…",
      spellcheck: "false",
      on: {
        input: debounce((e) => this.setFilter(e.target.value), 120),
        keydown: (e) => {
          if (e.key === "Escape") { e.stopPropagation(); this.closeFilter(); }
          if (e.key === "Enter") { e.preventDefault(); this.rowsEl.focus(); }
        },
      },
    });
    this.filterBar = h("div", { class: "pane__filter" },
      svg(ICONS.filter),
      this.filterInput,
      h("span", { class: "hint", text: "Tozalash uchun Esc" }),
    );
    this.statusEl = h("div", { class: "pane__status" });
    root.append(
      this.driveBar,
      this.tabsEl,
      this.crumbEl,
      h("div", { class: "pane__grid" }, this.colsEl, this.rowsEl),
      this.filterBar,
      this.statusEl,
    );
    this._applyColumnWidths();
    this._ro = new ResizeObserver(() => this._paintRows());
    this._ro.observe(this.rowsEl);
    root.addEventListener("mousedown", () => this.activate(), true);
  }

  _iconBtn(icon, title, onClick) {
    return h("button", {
      class: "icon-btn", type: "button", title, "aria-label": title,
      on: { click: onClick },
    }, svg(icon));
  }

  _renderCols() {
    clear(this.colsEl);
    for (const c of COLUMNS) {
      const el = h("button", {
        class: "col",
        type: "button",
        dataset: { key: c.key, num: c.num ? "1" : "0" },
        title: `${c.label} bo'yicha saralash`,
        on: { click: () => this.sortBy(c.key) },
      },
        h("span", { text: c.label }),
        svg(ICONS.chevronUp),
      );
      el.lastElementChild.classList.add("col__sort");
      const grip = h("span", {
        class: "col__resize",
        on: { mousedown: (e) => this._startColResize(e, c.key) },
      });
      el.appendChild(grip);
      this.colsEl.appendChild(el);
    }
    this._paintSortIndicator();
  }

  _paintSortIndicator() {
    for (const el of this.colsEl.children) {
      const active = el.dataset.key === this.tab.sortKey;
      if (active) el.dataset.sorted = this.tab.sortDir > 0 ? "asc" : "desc";
      else delete el.dataset.sorted;
      const ic = el.querySelector(".col__sort");
      if (ic) ic.style.transform = active && this.tab.sortDir < 0 ? "rotate(180deg)" : "";
    }
  }

  _startColResize(ev, key) {
    ev.preventDefault();
    ev.stopPropagation();
    const map = { modified: "date" };
    const prop = map[key];
    if (!prop) return;
    const grip = ev.currentTarget;
    grip.dataset.dragging = "1";
    const startX = ev.clientX;
    const cols = { ...get("columns") };
    const startW = cols[prop] ?? 80;
    const move = (e) => {
      const w = Math.max(36, Math.min(400, startW + (e.clientX - startX)));
      cols[prop] = Math.round(w);
      set({ columns: cols }, { silent: true });
      emit("columns:changed", cols);
    };
    const up = () => {
      delete grip.dataset.dragging;
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      set({ columns: cols });
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }

  _applyColumnWidths() {
    this.root.style.setProperty("--c-date", `${get("columns").date}px`);
    this._readRowHeight();
  }

  _readRowHeight() {
    const px = parseFloat(getComputedStyle(this.rowsEl).getPropertyValue("--row-h"));
    this.rowH = Number.isFinite(px) && px > 0 ? px : get("rowHeight");
    return this.rowH;
  }

  async navigate(path, { pushHistory = true, focusName = null } = {}) {
    if (!path) return;
    if (this.tab.locked && this.tab.path && path !== this.tab.path) {

      this.addTab(path);
      return;
    }
    this.loading = true;
    this._renderStatus();
    let listing;
    try {
      listing = await api.listDir(path, get("showHidden"));
    } catch (err) {
      this.loading = false;
      toast(String(err), { kind: "error", title: "Papkani ochib bo'lmadi" });
      if (!this.listing) {
        const fallback = state.sys.home;
        if (path !== fallback) return this.navigate(fallback);
      }
      this._renderStatus();
      return;
    }
    this.loading = false;
    const previous = this.tab.path;
    this.listing = listing;
    this.tab.path = listing.path;
    this.tab.selected.clear();
    this.tab.filter = "";
    this.filterInput.value = "";
    this.root.dataset.filter = "0";
    if (pushHistory) {
      const hist = this.tab.history.slice(0, this.tab.hIdx + 1);
      if (hist[hist.length - 1] !== listing.path) hist.push(listing.path);
      this.tab.history = hist.slice(-80);
      this.tab.hIdx = this.tab.history.length - 1;
    }
    this.entries = listing.parent ? [parentEntry(listing.parent), ...listing.entries] : [...listing.entries];
    this._resort();
    const target = focusName || (isChildOf(previous, listing.path) ? fmt.baseName(previous) : null);
    this.tab.cursor = target ? Math.max(0, this.view.findIndex((e) => e.fileName === target)) : 0;
    this.rowsEl.scrollTop = 0;
    this._renderTabs();
    this._renderCrumb();
    this._renderDrive();
    this._scheduleRender();
    this._renderStatus();
    this._scrollCursorIntoView();
    set({ lastPaths: { ...get("lastPaths"), [this.side]: listing.path } }, { silent: true });
  }

  reload(keepCursor = true) {
    const name = keepCursor ? this.cursorEntry?.fileName : null;
    const scroll = this.rowsEl.scrollTop;
    const marked = new Set(this.tab.selected);
    return this.navigate(this.path, { pushHistory: false, focusName: name }).then(() => {
      for (const p of marked) if (this.entries.some((e) => e.path === p)) this.tab.selected.add(p);
      this.rowsEl.scrollTop = scroll;
      this._scheduleRender();
      this._renderStatus();
    });
  }

  goParent() {
    if (this.listing?.parent) this.navigate(this.listing.parent);
  }

  goBack() {
    if (this.tab.hIdx > 0) {
      this.tab.hIdx--;
      this.navigate(this.tab.history[this.tab.hIdx], { pushHistory: false });
    }
  }

  goForward() {
    if (this.tab.hIdx < this.tab.history.length - 1) {
      this.tab.hIdx++;
      this.navigate(this.tab.history[this.tab.hIdx], { pushHistory: false });
    }
  }

  activate() {
    if (state.activeSide === this.side) return;
    state.activeSide = this.side;
    emit("panel:activated", this.side);
  }

  focus() {
    this.activate();
    this.rowsEl.focus({ preventScroll: true });
  }

  setActiveStyle(active) {
    this.root.dataset.active = active ? "1" : "0";
  }

  addTab(path) {
    const t = newTab(path || this.path);
    this.tabs.push(t);
    this.tabIdx = this.tabs.length - 1;
    this._renderTabs();
    this.navigate(t.path || state.sys.home);
  }

  closeTab(idx = this.tabIdx) {
    if (this.tabs.length <= 1) return;
    this.tabs.splice(idx, 1);
    this.tabIdx = Math.min(this.tabIdx, this.tabs.length - 1);
    this._renderTabs();
    this.navigate(this.tab.path, { pushHistory: false });
  }

  selectTab(idx) {
    if (idx < 0 || idx >= this.tabs.length || idx === this.tabIdx) return;
    this.tab.scrollTop = this.rowsEl.scrollTop;
    this.tabIdx = idx;
    this._renderTabs();
    this.navigate(this.tab.path, { pushHistory: false }).then(() => {
      this.rowsEl.scrollTop = this.tab.scrollTop || 0;
    });
  }

  nextTab(dir = 1) {
    this.selectTab((this.tabIdx + dir + this.tabs.length) % this.tabs.length);
  }

  toggleTabLock() {
    this.tab.locked = !this.tab.locked;
    this._renderTabs();
    toast(this.tab.locked ? "Varaq qulflandi" : "Varaq qulfi ochildi", { kind: "ok" });
  }

  _renderTabs() {
    clear(this.tabsEl);
    if (this.tabs.length <= 1) return;
    this.tabs.forEach((t, i) => {
      const name = fmt.baseName(t.path) || t.path || "Yangi varaq";
      const el = h("div", {
        class: "ptab",
        dataset: { active: i === this.tabIdx ? "1" : "0", locked: t.locked ? "1" : "0" },
        title: t.path,
        on: {
          mousedown: (e) => {
            if (e.button === 1) { e.preventDefault(); this.closeTab(i); }
            else this.selectTab(i);
          },
        },
      },
        h("span", { class: "ptab__name", text: name }),
        h("button", {
          class: "ptab__close", type: "button", title: "Varaqni yopish",
          on: { click: (e) => { e.stopPropagation(); this.closeTab(i); } },
        }, svg(ICONS.x)),
      );
      this.tabsEl.appendChild(el);
    });
  }

  _renderCrumb() {
    const sep = state.sys.sep;
    const p = this.path || "";
    clear(this.crumbEl);
    const parts = [];
    if (sep === "\\") {
      const m = p.match(/^([a-zA-Z]:\\?|\\\\[^\\]+\\[^\\]+\\?)/);
      const root = m ? m[1] : "";
      parts.push({ label: root || p, path: root || p });
      p.slice(root.length).split(/\\+/).filter(Boolean).forEach((seg, i, arr) => {
        parts.push({ label: seg, path: root + arr.slice(0, i + 1).join("\\") });
      });
    } else {
      parts.push({ label: "/", path: "/" });
      p.split("/").filter(Boolean).forEach((seg, i, arr) => {
        parts.push({ label: seg, path: `/${arr.slice(0, i + 1).join("/")}` });
      });
    }
    parts.forEach((part, i) => {

      if (i > 0 && !parts[i - 1].path.endsWith(sep)) {
        this.crumbEl.appendChild(h("span", { class: "crumb__sep", text: sep }));
      }
      this.crumbEl.appendChild(h("button", {
        class: "crumb__seg",
        type: "button",
        dataset: { last: i === parts.length - 1 ? "1" : "0" },
        text: part.label,
        on: { click: () => this.navigate(part.path) },
      }));
    });
  }

  editPath() {
    clear(this.crumbEl);
    const input = h("input", {
      class: "crumb__edit",
      value: this.path,
      spellcheck: "false",
      on: {
        keydown: (e) => {
          e.stopPropagation();
          if (e.key === "Enter") { this.navigate(input.value.trim()); }
          if (e.key === "Escape") { this._renderCrumb(); this.rowsEl.focus(); }
        },
        blur: () => this._renderCrumb(),
      },
    });
    this.crumbEl.appendChild(input);
    input.focus();
    input.select();
  }

  async _renderDrive() {
    const vol = await api.volumeInfo(this.path).catch(() => null);
    const label = vol?.label || (state.sys.sep === "\\" ? this.path.slice(0, 3) : "/");
    this.driveLabel.textContent = label;
    if (vol && vol.total) {
      this.freeText.textContent =
        `${fmt.toKilo(vol.total)} k dan ${fmt.toKilo(vol.free)} k bo'sh`;
      this.freeText.title = `${vol.name || ""} ${vol.fs || ""}`.trim();
    } else {
      this.freeText.textContent = "";
    }
  }

  sortBy(key) {
    if (this.tab.sortKey === key) this.tab.sortDir *= -1;
    else { this.tab.sortKey = key; this.tab.sortDir = 1; }
    const keep = this.cursorEntry?.path;
    this._resort();
    if (keep) {
      const i = this.view.findIndex((e) => e.path === keep);
      if (i >= 0) this.tab.cursor = i;
    }
    this._paintSortIndicator();
    this._scheduleRender();
    this._scrollCursorIntoView();
  }

  _resort() {
    const f = this.tab.filter.trim().toLowerCase();
    let list = this.entries;
    if (f) {
      const isMask = /[*?]/.test(f);
      list = list.filter((e) => {
        if (e.isParent) return true;
        const n = e.fileName.toLowerCase();
        return isMask ? maskMatch(n, f) : n.includes(f);
      });
    }
    this.view = sortEntries(list, this.tab.sortKey, this.tab.sortDir);
    if (this.tab.cursor >= this.view.length) this.tab.cursor = Math.max(0, this.view.length - 1);
  }

  setFilter(text) {
    this.tab.filter = text || "";
    this.root.dataset.filter = text ? "1" : this.root.dataset.filter;
    this._resort();
    this.tab.cursor = 0;
    this.rowsEl.scrollTop = 0;
    this._scheduleRender();
    this._renderStatus();
  }

  openFilter() {
    this.root.dataset.filter = "1";
    this.filterInput.focus();
    this.filterInput.select();
  }

  closeFilter() {
    this.root.dataset.filter = "0";
    this.filterInput.value = "";
    this.setFilter("");
    this.rowsEl.focus();
  }

  _onScroll() {
    this._paintRows();
  }

  _scheduleRender() {
    this._paintRows();
  }

  _paintRows() {
    const total = this.view.length;
    const rowH = this._readRowHeight();
    this.sizerEl.style.height = `${total * rowH}px`;

    const viewportH = this.rowsEl.clientHeight || 400;
    const scrollTop = this.rowsEl.scrollTop;
    const first = Math.max(0, Math.floor(scrollTop / rowH) - OVERSCAN);
    const count = Math.ceil(viewportH / rowH) + OVERSCAN * 2;
    const last = Math.min(total, first + count);
    this.viewEl.style.transform = `translateY(${first * rowH}px)`;
    const frag = document.createDocumentFragment();
    for (let i = first; i < last; i++) frag.appendChild(this._rowEl(this.view[i], i));
    clear(this.viewEl).appendChild(frag);
    if (!total) {
      this.viewEl.appendChild(h("div", {
        class: "rows__empty",
        text: this.tab.filter ? "Filtrga mos fayl yo'q" : "Bu papka bo'sh",
      }));
    }
  }

  _paintRowStates() {
    const t = this.tab;
    for (const row of this.viewEl.children) {
      const i = Number(row.dataset.i);
      const entry = this.view[i];
      if (!entry) continue;
      const selected = t.selected.has(entry.path);
      row.dataset.sel = selected ? "1" : "0";
      row.dataset.cursor = i === t.cursor ? "1" : "0";
      row.setAttribute("aria-selected", selected ? "true" : "false");
    }
  }

  _rowEl(entry, index) {
    const t = this.tab;
    const selected = t.selected.has(entry.path);
    const nameEl = h("span", { class: "row__name" });
    const q = t.filter.trim();
    if (q && !entry.isParent && !/[*?]/.test(q)) {
      const idx = entry.fileName.toLowerCase().indexOf(q.toLowerCase());
      if (idx >= 0) {
        nameEl.append(
          document.createTextNode(entry.fileName.slice(0, idx)),
          h("mark", { text: entry.fileName.slice(idx, idx + q.length) }),
          document.createTextNode(entry.fileName.slice(idx + q.length)),
        );
      } else nameEl.textContent = displayName(entry);
    } else {
      nameEl.textContent = displayName(entry);
    }

    return h("div", {
      class: "row",
      role: "option",
      "aria-selected": selected ? "true" : "false",
      dataset: {
        i: index,
        sel: selected ? "1" : "0",
        cursor: index === t.cursor ? "1" : "0",
        dir: entry.isDir ? "1" : "0",
        link: entry.isSymlink ? "1" : "0",
        hidden: entry.isHidden ? "1" : "0",
      },
      title: entry.isParent ? "Yuqoridagi papka" : entry.path,
    },
      h("div", { class: "cell cell--name" }, fileIconNode(entry), nameEl),
      h("div", { class: "cell cell--dim cell--num", text: entry.isParent ? "" : fmt.stamp(entry.modified) }),
    );
  }

  _scrollCursorIntoView() {
    const top = this.tab.cursor * this.rowH;
    const bottom = top + this.rowH;
    const vt = this.rowsEl.scrollTop;
    const vb = vt + this.rowsEl.clientHeight;
    let next = vt;
    if (top < vt) next = top;
    else if (bottom > vb) next = bottom - this.rowsEl.clientHeight;
    if (next !== vt) {
      this.rowsEl.scrollTop = next;
      this._paintRows();
    } else {
      this._paintRowStates();
    }
  }

  setCursor(i, { extend = false } = {}) {
    const n = this.view.length;
    if (!n) return;
    const from = this.tab.cursor;
    this.tab.cursor = Math.max(0, Math.min(n - 1, i));
    if (extend) {
      const [a, b] = from <= this.tab.cursor ? [from, this.tab.cursor] : [this.tab.cursor, from];
      for (let k = a; k <= b; k++) {
        const e = this.view[k];
        if (e && !e.isParent) this.tab.selected.add(e.path);
      }
    }
    this._scrollCursorIntoView();
    this._renderStatus();
  }

  toggleSelect(i = this.tab.cursor) {
    const e = this.view[i];
    if (!e || e.isParent) return;
    if (this.tab.selected.has(e.path)) this.tab.selected.delete(e.path);
    else this.tab.selected.add(e.path);
    this._paintRowStates();
    this._renderStatus();
  }

  selectAll(on = true) {
    if (on) for (const e of this.view) { if (!e.isParent) this.tab.selected.add(e.path); }
    else this.tab.selected.clear();
    this._paintRowStates();
    this._renderStatus();
  }

  invertSelection() {
    for (const e of this.view) {
      if (e.isParent) continue;
      if (this.tab.selected.has(e.path)) this.tab.selected.delete(e.path);
      else this.tab.selected.add(e.path);
    }
    this._paintRowStates();
    this._renderStatus();
  }

  selectByMask(mask, on = true) {
    const m = (mask || "*").trim().toLowerCase();
    let n = 0;
    for (const e of this.view) {
      if (e.isParent) continue;
      if (maskMatchList(e.fileName.toLowerCase(), m)) {
        if (on) this.tab.selected.add(e.path); else this.tab.selected.delete(e.path);
        n++;
      }
    }
    this._paintRowStates();
    this._renderStatus();
    return n;
  }

  selectSameExt(on = true) {
    const c = this.cursorEntry;
    if (!c) return;
    for (const e of this.view) {
      if (e.isParent) continue;
      if (e.ext.toLowerCase() === c.ext.toLowerCase()) {
        if (on) this.tab.selected.add(e.path); else this.tab.selected.delete(e.path);
      }
    }
    this._paintRowStates();
    this._renderStatus();
  }

  _rowIndexFromEvent(e) {
    const row = e.target.closest(".row");
    return row ? Number(row.dataset.i) : -1;
  }

  _onMouseDown(e) {
    this.activate();
    const i = this._rowIndexFromEvent(e);
    if (i < 0) return;
    if (e.button === 2) {
      if (!this.tab.selected.has(this.view[i]?.path)) this.setCursor(i);
      this._paintRowStates();
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      this.tab.cursor = i;
      this.toggleSelect(i);
    } else if (e.shiftKey) {
      this.setCursor(i, { extend: true });
    } else {
      this.tab.selected.clear();
      this.setCursor(i);
    }
    this._paintRowStates();
  }

  _onDblClick(e) {
    const i = this._rowIndexFromEvent(e);
    if (i < 0) return;
    this.setCursor(i);
    const entry = this.view[i];
    if (entry?.isDir || get("doubleClickOpens")) this.open();
  }

  _onContext(e) {
    e.preventDefault();
    const i = this._rowIndexFromEvent(e);
    emit("panel:context", { side: this.side, x: e.clientX, y: e.clientY, index: i });
  }

  async open(entry = this.cursorEntry) {
    if (!entry) return;
    if (entry.isDir) return this.navigate(entry.path);
    if (await api.archiveIsSupported(entry.path).catch(() => false)) {
      emit("archive:open", { side: this.side, path: entry.path });
      return;
    }
    try { await api.openPath(entry.path); }
    catch (err) { toast(String(err), { kind: "error", title: "Ochib bo'lmadi" }); }
  }

  _onKey(e) {
    const t = this.tab;
    const key = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    const pageRows = Math.max(1, Math.floor(this.rowsEl.clientHeight / this.rowH) - 1);
    switch (key) {
      case "ArrowDown": e.preventDefault(); this.setCursor(t.cursor + 1, { extend: e.shiftKey }); return;
      case "ArrowUp": e.preventDefault(); this.setCursor(t.cursor - 1, { extend: e.shiftKey }); return;
      case "PageDown": e.preventDefault(); this.setCursor(t.cursor + pageRows, { extend: e.shiftKey }); return;
      case "PageUp": e.preventDefault(); this.setCursor(t.cursor - pageRows, { extend: e.shiftKey }); return;
      case "Home": if (!ctrl) { e.preventDefault(); this.setCursor(0, { extend: e.shiftKey }); } return;
      case "End": if (!ctrl) { e.preventDefault(); this.setCursor(this.view.length - 1, { extend: e.shiftKey }); } return;
      case "Enter": e.preventDefault(); this.open(); return;
      case " ":
        e.preventDefault();
        this.toggleSelect();
        this.setCursor(t.cursor);
        return;
      case "Insert":
        e.preventDefault();
        this.toggleSelect();
        this.setCursor(t.cursor + 1);
        return;
      case "Backspace":
        e.preventDefault();
        this.goParent();
        return;
      case "Escape":
        if (t.filter) { e.preventDefault(); this.closeFilter(); }
        return;
      default: break;
    }
    if (ctrl && key.toLowerCase() === "a") { e.preventDefault(); this.selectAll(true); return; }
    if (key === "*" ) { e.preventDefault(); this.invertSelection(); return; }
    if (key === "+" && !ctrl) { e.preventDefault(); emit("panel:selectMask", { side: this.side, on: true }); return; }
    if (key === "-" && !ctrl) { e.preventDefault(); emit("panel:selectMask", { side: this.side, on: false }); return; }
    if (!ctrl && !e.altKey && key.length === 1 && key !== " ") {
      e.preventDefault();
      this._quickSearch(key);
    }
  }

  _quickSearch(ch) {
    clearTimeout(this.quick.timer);
    this.quick.text += ch.toLowerCase();
    this.quick.timer = setTimeout(() => { this.quick.text = ""; }, 900);
    const q = this.quick.text;
    const n = this.view.length;
    for (let k = 1; k <= n; k++) {
      const i = (this.tab.cursor + (q.length > 1 ? 0 : k)) % n;
      const e = this.view[i];
      if (e && e.fileName.toLowerCase().startsWith(q)) {
        this.tab.selected.clear();
        this.setCursor(i);
        return;
      }
    }
  }

  _renderStatus() {
    const t = this.tab;
    const files = this.view.filter((e) => !e.isParent && !e.isDir);
    const dirs = this.view.filter((e) => !e.isParent && e.isDir);
    const selFiles = files.filter((e) => t.selected.has(e.path));
    const selDirs = dirs.filter((e) => t.selected.has(e.path));
    const selBytes = selFiles.reduce((a, e) => a + e.size, 0);
    const allBytes = files.reduce((a, e) => a + e.size, 0);
    clear(this.statusEl);
    if (this.loading) {
      this.statusEl.appendChild(h("span", { class: "grow", text: "Yuklanmoqda…" }));
      return;
    }
    this.statusEl.appendChild(h("span", { class: "grow" },
      h("b", { text: `${fmt.toKilo(selBytes)} k` }),
      ` / ${fmt.toKilo(allBytes)} k — `,
      h("b", { text: String(selFiles.length) }),
      ` / ${files.length} ta fayl, `,
      h("b", { text: String(selDirs.length) }),
      ` / ${dirs.length} ta papka`,
    ));
    if (t.filter) {
      this.statusEl.appendChild(h("span", { text: `filtr: ${t.filter}`, style: { color: "var(--accent)" } }));
    }
  }

  refreshChrome() {
    this._applyColumnWidths();
    this._renderTabs();
    this._scheduleRender();
    this._renderStatus();
  }
}

function isChildOf(child, parent) {
  if (!child || !parent || child === parent) return false;
  const base = parent.endsWith("/") || parent.endsWith("\\") ? parent : parent + state.sys.sep;
  return child.startsWith(base);
}

function displayName(entry) {
  return entry.isParent ? ".." : entry.fileName;
}

function maskMatch(name, pattern) {
  const rx = new RegExp(`^${pattern.split("").map((c) => {
    if (c === "*") return ".*";
    if (c === "?") return ".";
    return c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }).join("")}$`, "i");
  return rx.test(name);
}

function maskMatchList(name, masks) {
  return masks.split(/[;,]/).map((s) => s.trim()).filter(Boolean)
    .some((m) => maskMatch(name, m));
}
