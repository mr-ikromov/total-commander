import { h } from "../core/dom.js";
import { openDialog } from "./dialog.js";
import { ICONS } from "../core/icons.js";
import { toast } from "./toast.js";
import { get, set, DEFAULTS } from "../core/store.js";
import { prettyKey } from "./commands.js";

const THEMES = [["dark", "Qorong'i"], ["light", "Yorug'"], ["midnight", "Yarim tun"]];

export function openSettings(app) {
  const f = {};
  const body = h("div", {},
    h("fieldset", { class: "group" },
      h("legend", { text: "Ko'rinish" }),
      h("div", { class: "row-2" },
        h("div", { class: "field" }, h("label", { text: "Mavzu" }),
          f.theme = h("select", { class: "select" },
            ...THEMES.map(([v, l]) => h("option", { value: v, text: l, selected: v === get("theme") })))),
        h("div", { class: "field" }, h("label", { text: "Qator balandligi (px)" }),
          f.rowHeight = h("input", { class: "input", type: "number", min: "20", max: "48", value: String(get("rowHeight")) })),
      ),
      h("div", { class: "inline" },
        h("label", { class: "check" }, f.showHidden = h("input", { type: "checkbox", checked: get("showHidden") }), "Yashirin fayllar"),
      ),
    ),
    h("fieldset", { class: "group" },
      h("legend", { text: "Panellar" }),
      h("div", { class: "inline" },
        h("label", { class: "check" }, f.dirsFirst = h("input", { type: "checkbox", checked: get("dirsFirst") }), "Avval papkalar"),
        h("label", { class: "check" }, f.sortCase = h("input", { type: "checkbox", checked: get("sortCaseSensitive") }), "Saralashda harf farqi"),
        h("label", { class: "check" }, f.dblOpen = h("input", { type: "checkbox", checked: get("doubleClickOpens") }), "Ikki marta bosish faylni ochadi"),
      ),
    ),
    h("fieldset", { class: "group" },
      h("legend", { text: "Fayl amallari" }),
      h("div", { class: "field" },
        h("label", { text: "Ziddiyatda nima qilish" }),
        f.conflict = h("select", { class: "select" },
          ...[["ask", "So'rash"], ["overwrite", "Ustiga yozish"], ["skip", "O'tkazib yuborish"], ["rename", "Avto nomlash"], ["newer", "Faqat yangisi"]]
            .map(([v, l]) => h("option", { value: v, text: l, selected: v === get("defaultConflict") })))),
      h("div", { class: "inline" },
        h("label", { class: "check" }, f.confirmDelete = h("input", { type: "checkbox", checked: get("confirmDelete") }), "O'chirishdan oldin so'rash"),
        h("label", { class: "check" }, f.trash = h("input", { type: "checkbox", checked: get("deleteToTrash") }), "Savatga o'chirish"),
        h("label", { class: "check" }, f.times = h("input", { type: "checkbox", checked: get("preserveTimes") }), "Vaqt belgilarini saqlash"),
      ),
    ),
  );
  const dlg = openDialog({
    title: "Sozlamalar",
    icon: ICONS.cog,
    size: "md",
    body,
    buttons: [
      { label: "Boshlang'ich holatga", onClick: () => { set({ ...DEFAULTS }); apply(); dlg.close(null); toast("Sozlamalar tiklandi", { kind: "ok" }); } },
      "spacer",
      { label: "Bekor qilish", onClick: (a) => a.close(null) },
      { label: "Qo'llash", variant: "primary", default: true, onClick: (a) => { save(); a.close(true); } },
    ],
  });
  function save() {
    set({
      theme: f.theme.value,
      rowHeight: Math.max(20, Math.min(48, Number(f.rowHeight.value) || 26)),
      showHidden: f.showHidden.checked,
      dirsFirst: f.dirsFirst.checked,
      sortCaseSensitive: f.sortCase.checked,
      doubleClickOpens: f.dblOpen.checked,
      defaultConflict: f.conflict.value,
      confirmDelete: f.confirmDelete.checked,
      deleteToTrash: f.trash.checked,
      preserveTimes: f.times.checked,
    });
    apply();
  }
  function apply() {
    app.applyChrome();
    app.panels.left.refreshChrome();
    app.panels.right.refreshChrome();
    app.panels.left.reload();
    app.panels.right.reload();
  }
  return dlg.result;
}

export function openShortcuts(commands) {
  const rows = commands
    .filter((c) => c.key)
    .map((c) => h("tr", {},
      h("td", { class: "mono", style: { width: "180px", color: "var(--accent)" }, text: prettyKey(c.key) }),
      h("td", { text: c.label }),
      h("td", { style: { color: "var(--fg-faint)" }, text: c.group || "" }),
    ));
  const body = h("div", { class: "dtable-wrap", style: { maxHeight: "62vh" } },
    h("table", { class: "dtable" },
      h("thead", {}, h("tr", {}, h("th", { text: "Yorliq" }), h("th", { text: "Amal" }), h("th", { text: "Guruh" }))),
      h("tbody", {}, ...rows)));
  return openDialog({
    title: "Klaviatura yorliqlari",
    icon: ICONS.info,
    size: "lg",
    body,
    buttons: ["spacer", { label: "Yopish", variant: "primary", default: true, onClick: (a) => a.close(null) }],
  }).result;
}
