import { h, clear } from "../core/dom.js";
import { openDialog, confirmDialog } from "./dialog.js";
import { openProgress } from "./progress.js";
import { ICONS } from "../core/icons.js";
import { toast, toastError } from "./toast.js";
import * as api from "../core/api.js";
import * as fmt from "../core/format.js";

const LABEL = {
  same: "bir xil",
  different: "farqli",
  "left-only": "faqat chapda",
  "right-only": "faqat o'ngda",
  "left-newer": "chapdagi yangiroq",
  "right-newer": "o'ngdagi yangiroq",
};

export async function openCompareDirs(app) {
  const left = app.panels.left;
  const right = app.panels.right;
  let rows = [];
  const tbody = h("tbody");
  const summary = h("div", { style: { fontSize: "11.5px", color: "var(--fg-dim)", margin: "8px 0" }, text: "Hali solishtirilmagan." });
  const f = {};
  const head = h("div", {},
    h("div", { class: "row-2" },
      h("div", { class: "field" }, h("label", { text: "Chap" }),
        f.left = h("input", { class: "input input--mono", type: "text", value: left.path, spellcheck: "false" })),
      h("div", { class: "field" }, h("label", { text: "O'ng" }),
        f.right = h("input", { class: "input input--mono", type: "text", value: right.path, spellcheck: "false" })),
    ),
    h("div", { class: "inline" },
      h("label", { class: "check" }, f.rec = h("input", { type: "checkbox", checked: true }), "Ichki papkalar bilan"),
      h("label", { class: "check" }, f.content = h("input", { type: "checkbox" }), "Mazmuni bo'yicha (sekinroq)"),
      h("label", { class: "check" }, f.hideSame = h("input", { type: "checkbox", checked: true }), "Bir xillarini yashirish"),
    ),
    summary,
    h("div", { class: "dtable-wrap", style: { maxHeight: "44vh" } },
      h("table", { class: "dtable" },
        h("thead", {}, h("tr", {},
          h("th", { text: "Nisbiy yo'l" }),
          h("th", { class: "num", text: "Chap hajm" }),
          h("th", { text: "Holati" }),
          h("th", { class: "num", text: "O'ng hajm" }))),
        tbody)),
  );

  const dlg = openDialog({
    title: "Papkalarni sinxronlash",
    icon: ICONS.sync,
    size: "xl",
    body: head,
    buttons: [
      { label: "Chapdan o'ngga", icon: ICONS.chevronRight, onClick: () => sync("ltr") },
      { label: "O'ngdan chapga", icon: ICONS.chevronLeft, onClick: () => sync("rtl") },
      "spacer",
      { label: "Yopish", onClick: (a) => a.close(null) },
      { label: "Solishtirish", variant: "primary", default: true, onClick: () => compare() },
    ],
  });

  for (const el of [f.rec, f.content]) el.addEventListener("change", () => { rows = []; paint(); });
  f.hideSame.addEventListener("change", paint);

  async function compare() {
    summary.textContent = "Solishtirilmoqda…";
    try {
      const result = await api.compareDirs(
        f.left.value.trim(), f.right.value.trim(), f.rec.checked, f.content.checked);
      rows = Array.isArray(result) ? result : [];
      paint();
    } catch (err) {
      summary.textContent = "";
      toastError(err, "Solishtirib bo'lmadi");
    }
  }

  function visibleRows() {
    return f.hideSame.checked ? rows.filter((r) => r.status !== "same") : rows;
  }

  function paint() {
    clear(tbody);
    const list = visibleRows();
    const counts = rows.reduce((acc, r) => (acc[r.status] = (acc[r.status] || 0) + 1, acc), {});
    summary.textContent = rows.length ? Object.entries(counts).map(([k, v]) => `${LABEL[k] || k}: ${v}`).join(" · ") : "Farq topilmadi.";
    const frag = document.createDocumentFragment();
    for (const r of list.slice(0, 5000)) {
      const rel = (r.left || r.right)?.path || "";
      const name = fmt.baseName(rel);
      frag.appendChild(h("tr", { title: rel },
        h("td", {}, h("span", { class: "status-dot", dataset: { s: r.status } }), name),
        h("td", { class: "num", text: r.left ? (r.left.isDir ? "—" : fmt.shortSize(r.left.size)) : "—" }),
        h("td", { text: LABEL[r.status] || r.status }),
        h("td", { class: "num", text: r.right ? (r.right.isDir ? "—" : fmt.shortSize(r.right.size)) : "—" }),
      ));
    }
    tbody.appendChild(frag);
  }

  async function sync(direction) {
    const wanted = direction === "ltr"
      ? rows.filter((r) => r.status === "left-only" || r.status === "left-newer")
      : rows.filter((r) => r.status === "right-only" || r.status === "right-newer");
    const sources = wanted
      .map((r) => (direction === "ltr" ? r.left : r.right))
      .filter((e) => e && !e.isDir)
      .map((e) => e.path);
    if (!sources.length) return toast("Bu yo'nalishda sinxronlanadigan narsa yo'q", { kind: "warn" });

    const targetRoot = direction === "ltr" ? f.right.value.trim() : f.left.value.trim();
    const ok = await confirmDialog({
      title: "Sinxronlash",
      message: `${sources.length} ta fayl ${targetRoot} ga nusxalansinmi?`,
      okLabel: "Nusxalash",
      icon: ICONS.sync,
    });
    if (!ok) return;

    const sourceRoot = direction === "ltr" ? f.left.value.trim() : f.right.value.trim();
    const groups = new Map();
    for (const p of sources) {
      const rel = p.slice(sourceRoot.length).replace(/^[\\/]/, "");
      const sub = fmt.dirName(rel);
      const dir = sub && sub !== rel ? `${targetRoot}${app.sep}${sub}` : targetRoot;
      if (!groups.has(dir)) groups.set(dir, []);
      groups.get(dir).push(p);
    }

    const jobId = api.newJobId();
    const prog = openProgress(jobId, "copy");
    try {
      for (const [dir, paths] of groups) {
        await api.copyItems(api.makeOpRequest(paths, dir, { jobId, conflict: "overwrite" }));
      }
      prog.close();
      toast(`${sources.length} ta fayl sinxronlandi`, { kind: "ok", title: "Sinxronlash" });
      await Promise.all([left.reload(), right.reload()]);
      compare();
    } catch (err) {
      prog.close();
      toastError(err, "Sinxronlab bo'lmadi");
    }
  }

  compare();
  return dlg.result;
}
