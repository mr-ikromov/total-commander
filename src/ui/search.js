import { h, clear, svg } from "../core/dom.js";
import { openDialog } from "./dialog.js";
import { ICONS } from "../core/icons.js";
import { toast, toastError } from "./toast.js";
import * as api from "../core/api.js";
import * as fmt from "../core/format.js";

export async function openSearch(app) {
  const panel = app.active();
  let jobId = null;
  let hits = [];
  let cursor = 0;
  let unlisten = [];
  const f = {};
  const form = h("div", {},
    h("div", { class: "row-2" },
      h("div", { class: "field" },
        h("label", { text: "Qidiruv niqobi" }),
        f.mask = h("input", { class: "input input--mono", type: "text", placeholder: "*.txt;*.md", spellcheck: "false" })),
      h("div", { class: "field" },
        h("label", { text: "Qayerdan qidirish" }),
        f.root = h("input", { class: "input input--mono", type: "text", value: panel.path, spellcheck: "false" })),
    ),
    h("div", { class: "field" },
      h("label", { text: "Ichidagi matn (ixtiyoriy)" }),
      f.content = h("input", { class: "input", type: "text", placeholder: "matn yoki muntazam ifoda", spellcheck: "false" })),
    h("div", { class: "inline", style: { marginBottom: "12px" } },
      h("label", { class: "check" }, f.regex = h("input", { type: "checkbox" }), "Muntazam ifoda"),
      h("label", { class: "check" }, f.case = h("input", { type: "checkbox" }), "Katta-kichik harf farqi"),
      h("label", { class: "check" }, f.words = h("input", { type: "checkbox" }), "Butun so'zlar"),
      h("label", { class: "check" }, f.hidden = h("input", { type: "checkbox" }), "Yashirinlarni ham"),
    ),
    h("fieldset", { class: "group" },
      h("legend", { text: "Filtrlar" }),
      h("div", { class: "row-3" },
        h("div", { class: "field" }, h("label", { text: "Eng kichik hajm" }),
          f.min = h("input", { class: "input input--mono", type: "text", placeholder: "masalan 10k" })),
        h("div", { class: "field" }, h("label", { text: "Eng katta hajm" }),
          f.max = h("input", { class: "input input--mono", type: "text", placeholder: "masalan 4M" })),
        h("div", { class: "field" }, h("label", { text: "Chuqurlik (0 = cheksiz)" }),
          f.depth = h("input", { class: "input input--mono", type: "number", min: "0", value: "0" })),
      ),
      h("div", { class: "row-2" },
        h("div", { class: "field" }, h("label", { text: "Shundan keyin o'zgargan" }),
          f.newer = h("input", { class: "input", type: "datetime-local" })),
        h("div", { class: "field" }, h("label", { text: "Shundan oldin o'zgargan" }),
          f.older = h("input", { class: "input", type: "datetime-local" })),
      ),
    ),
  );

  const counter = h("div", { style: { fontSize: "11.5px", color: "var(--fg-dim)", marginBottom: "6px" }, text: "Tayyor." });
  const list = h("div", { class: "hit-list" });
  const results = h("div", {
    class: "dtable-wrap",
    style: { maxHeight: "38vh", padding: "4px" },
    on: {
      click: (e) => {
        const row = e.target.closest(".hit");
        if (!row) return;
        cursor = Number(row.dataset.i);
        paint();
      },
      dblclick: (e) => {
        const row = e.target.closest(".hit");
        if (row) goTo(hits[Number(row.dataset.i)]);
      },
    },
  }, list);

  const body = h("div", {}, form, counter, results);
  let startBtn, stopBtn, gotoBtn, feedBtn;
  const dlg = openDialog({
    title: "Fayllarni qidirish",
    icon: ICONS.search,
    size: "lg",
    body,
    buttons: [
      { label: "Panelga chiqarish", icon: ICONS.columns, ref: (el) => (feedBtn = el), onClick: () => feedToPanel() },
      "spacer",
      { label: "To'xtatish", ref: (el) => (stopBtn = el), disabled: true, onClick: () => stop() },
      { label: "Faylga o'tish", ref: (el) => (gotoBtn = el), disabled: true, onClick: () => goTo(hits[cursor]) },
      { label: "Qidirishni boshlash", variant: "primary", default: true, ref: (el) => (startBtn = el), onClick: () => start() },
    ],
    onKeydown: (e) => {
      if (e.target.tagName === "INPUT") return false;
      if (e.key === "ArrowDown") { e.preventDefault(); cursor = Math.min(hits.length - 1, cursor + 1); paint(); return true; }
      if (e.key === "ArrowUp") { e.preventDefault(); cursor = Math.max(0, cursor - 1); paint(); return true; }
      return false;
    },
  });

  dlg.result.then(() => { stop(); unlisten.forEach((u) => u?.()); });
  function paint() {
    clear(list);
    if (!hits.length) {
      list.appendChild(h("div", { class: "rows__empty", text: "Hali natija yo'q" }));
      gotoBtn.disabled = true;
      return;
    }
    gotoBtn.disabled = false;
    const frag = document.createDocumentFragment();
    hits.slice(0, 3000).forEach((hit, i) => {
      const ico = svg(hit.isDir ? ICONS.folder : ICONS.file);
      frag.appendChild(h("div", {
        class: "hit", dataset: { i, cursor: i === cursor ? "1" : "0" }, title: hit.path,
      },
        ico,
        h("div", { class: "hit__main" },
          h("div", { class: "hit__path", text: hit.path }),
          hit.lineText ? h("div", { class: "hit__ctx", text: `${hit.lineNo}: ${hit.lineText}` }) : null),
        h("div", { class: "hit__size", text: hit.isDir ? "—" : fmt.shortSize(hit.size) }),
      ));
    });
    list.appendChild(frag);
    list.querySelector('[data-cursor="1"]')?.scrollIntoView({ block: "nearest" });
  }

  async function start() {
    stop();
    hits = [];
    cursor = 0;
    paint();
    const q = api.makeSearchQuery([f.root.value.trim() || panel.path], {
      nameMask: f.mask.value.trim(),
      content: f.content.value,
      useRegex: f.regex.checked,
      caseSensitive: f.case.checked,
      wholeWords: f.words.checked,
      includeHidden: f.hidden.checked,
      maxDepth: Number(f.depth.value) || 0,
      minSize: fmt.parseSize(f.min.value) ?? null,
      maxSize: fmt.parseSize(f.max.value) ?? null,
      newerThan: f.newer.value ? new Date(f.newer.value).getTime() : null,
      olderThan: f.older.value ? new Date(f.older.value).getTime() : null,
    });
    jobId = q.jobId;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    counter.textContent = "Qidirilmoqda…";
    unlisten.forEach((u) => u?.());
    unlisten = [
      await api.onSearchHits(([id, batch]) => {
        if (id !== jobId) return;
        hits.push(...batch);
        counter.textContent = `${hits.length} ta moslik…`;
        paint();
      }),
      await api.onSearchProgress(([id, scanned]) => {
        if (id !== jobId) return;
        counter.textContent = `${hits.length} ta moslik · ${scanned} ta ko'rildi`;
      }),
      await api.onSearchDone(([id, total, cancelled]) => {
        if (id !== jobId) return;
        counter.textContent = `${total} ta moslik${cancelled ? " (to'xtatildi)" : ""}`;
        startBtn.disabled = false;
        stopBtn.disabled = true;
      }),
    ];
    try {
      const all = await api.findFiles(q);
      if (Array.isArray(all) && all.length && !hits.length) {
        hits = all;
        paint();
      }
    } catch (err) {
      toastError(err, "Qidiruv muvaffaqiyatsiz");
      startBtn.disabled = false;
      stopBtn.disabled = true;
    }
  }

  function stop() {
    if (jobId) api.cancelJob(jobId).catch(() => {});
    stopBtn && (stopBtn.disabled = true);
    startBtn && (startBtn.disabled = false);
  }

  async function goTo(hit) {
    if (!hit) return;
    dlg.close(null);
    const dir = hit.isDir ? hit.path : fmt.dirName(hit.path);
    await panel.navigate(dir, { focusName: hit.isDir ? null : fmt.baseName(hit.path) });
    panel.focus();
  }

  function feedToPanel() {
    if (!hits.length) return toast("Chiqariladigan natija yo'q", { kind: "warn" });
    dlg.close(null);
    app.showVirtualListing(panel, hits, `Qidiruv natijalari (${hits.length})`);
  }

  paint();
  requestAnimationFrame(() => f.mask.focus());
  return dlg.result;
}
