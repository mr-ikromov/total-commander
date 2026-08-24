import { h, clear, debounce } from "../core/dom.js";
import { openDialog } from "./dialog.js";
import { ICONS } from "../core/icons.js";
import { toast, toastError } from "./toast.js";
import * as api from "../core/api.js";
import * as fmt from "../core/format.js";

const HELP = `[N] to'liq nom   [N#-#] nom qismi   [E] kengaytma
[C] sanoq        [YMD] sana        [hms] vaqt
[P] ota papka    [L]/[U] kichik/katta harf`;

export async function openMultiRename(app) {
  const panel = app.active();
  const items = panel.selection().filter((e) => !e.isParent);
  if (!items.length) return toast("Avval fayllarni belgilang", { kind: "warn" });
  const f = {};
  const preview = h("tbody");
  const warn = h("div", { style: { color: "var(--warn)", fontSize: "11.5px", minHeight: "16px" } });
  const controls = h("div", {},
    h("div", { class: "row-2" },
      h("div", { class: "field" },
        h("label", { text: "Nom niqobi" }),
        f.name = h("input", { class: "input input--mono", type: "text", value: "[N]", spellcheck: "false" })),
      h("div", { class: "field" },
        h("label", { text: "Kengaytma" }),
        f.ext = h("input", { class: "input input--mono", type: "text", value: "[E]", spellcheck: "false" })),
    ),
    h("div", { class: "row-3" },
      h("div", { class: "field" }, h("label", { text: "Sanoq boshi" }),
        f.cStart = h("input", { class: "input input--mono", type: "number", value: "1" })),
      h("div", { class: "field" }, h("label", { text: "Qadam" }),
        f.cStep = h("input", { class: "input input--mono", type: "number", value: "1" })),
      h("div", { class: "field" }, h("label", { text: "Raqamlar soni" }),
        f.cDigits = h("input", { class: "input input--mono", type: "number", value: "1", min: "1", max: "9" })),
    ),
    h("fieldset", { class: "group" },
      h("legend", { text: "Qidirish va almashtirish" }),
      h("div", { class: "row-2" },
        h("div", { class: "field" }, h("label", { text: "Qidirish" }),
          f.find = h("input", { class: "input input--mono", type: "text", spellcheck: "false" })),
        h("div", { class: "field" }, h("label", { text: "Nimaga almashtirish" }),
          f.repl = h("input", { class: "input input--mono", type: "text", spellcheck: "false" })),
      ),
      h("div", { class: "inline" },
        h("label", { class: "check" }, f.regex = h("input", { type: "checkbox" }), "Muntazam ifoda"),
        h("label", { class: "check" }, f.icase = h("input", { type: "checkbox", checked: true }), "Harf farqiga e'tibor bermaslik"),
        h("label", { class: "check" }, f.all = h("input", { type: "checkbox", checked: true }), "Hammasini almashtirish"),
      ),
    ),
    h("div", { class: "inline", style: { marginBottom: "10px" } },
      h("span", { style: { fontSize: "11px", color: "var(--fg-faint)", whiteSpace: "pre-line" }, text: HELP })),
    warn,
    h("div", { class: "dtable-wrap", style: { maxHeight: "34vh" } },
      h("table", { class: "dtable" },
        h("thead", {}, h("tr", {},
          h("th", { text: "#" }), h("th", { text: "Eski nom" }), h("th", { text: "Yangi nom" }))),
        preview)),
  );

  const dlg = openDialog({
    title: `Ommaviy nomlash — ${items.length} ta element`,
    icon: ICONS.rename,
    size: "lg",
    body: controls,
    buttons: [
      "spacer",
      { label: "Bekor qilish", onClick: (a) => a.close(null) },
      { label: "O'zgartirish", variant: "primary", default: true, onClick: () => run() },
    ],
  });
  const update = debounce(render, 90);
  for (const el of Object.values(f)) el.addEventListener("input", update);
  function build() {
    const start = Number(f.cStart.value) || 1;
    const step = Number(f.cStep.value) || 1;
    const digits = Math.max(1, Number(f.cDigits.value) || 1);
    const plan = [];
    items.forEach((item, i) => {
      const counter = String(start + i * step).padStart(digits, "0");
      let name = expand(f.name.value, item, counter);
      let ext = expand(f.ext.value, item, counter);
      let full = ext ? `${name}.${ext}` : name;
      full = replace(full);
      plan.push({ item, newName: full });
    });
    return plan;
  }
  function expand(mask, item, counter) {
    const d = new Date(item.modified || Date.now());
    const p2 = (n) => String(n).padStart(2, "0");
    let out = "";
    let i = 0;
    while (i < mask.length) {
      if (mask[i] !== "[") { out += mask[i++]; continue; }
      const end = mask.indexOf("]", i);
      if (end < 0) { out += mask.slice(i); break; }
      const token = mask.slice(i + 1, end);
      i = end + 1;
      const range = token.match(/^N(\d+)?(?:-(\d+))?$/i);
      if (range) {
        const from = range[1] ? Number(range[1]) - 1 : 0;
        const to = range[2] ? Number(range[2]) : (range[1] ? Number(range[1]) : item.name.length);
        out += item.name.slice(from, to);
        continue;
      }
      switch (token.toUpperCase()) {
        case "E": out += item.ext; break;
        case "C": out += counter; break;
        case "P": out += fmt.baseName(fmt.dirName(item.path)); break;
        case "Y": out += d.getFullYear(); break;
        case "M": out += p2(d.getMonth() + 1); break;
        case "D": out += p2(d.getDate()); break;
        case "H": out += p2(d.getHours()); break;
        case "MIN": out += p2(d.getMinutes()); break;
        case "S": out += p2(d.getSeconds()); break;
        case "YMD": out += `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`; break;
        case "HMS": out += `${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`; break;
        case "L": out += item.name.toLowerCase(); break;
        case "U": out += item.name.toUpperCase(); break;
        default: out += `[${token}]`;
      }
    }
    return out;
  }

  function replace(text) {
    const find = f.find.value;
    if (!find) return text;
    try {
      if (f.regex.checked) {
        const flags = `${f.all.checked ? "g" : ""}${f.icase.checked ? "i" : ""}`;
        return text.replace(new RegExp(find, flags), f.repl.value);
      }
      if (f.all.checked) {
        const flags = `g${f.icase.checked ? "i" : ""}`;
        return text.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags), f.repl.value);
      }
      const idx = f.icase.checked
        ? text.toLowerCase().indexOf(find.toLowerCase())
        : text.indexOf(find);
      return idx < 0 ? text : text.slice(0, idx) + f.repl.value + text.slice(idx + find.length);
    } catch {
      return text;
    }
  }

  function render() {
    const plan = build();
    clear(preview);
    const seen = new Map();
    let dupes = 0;
    let invalid = 0;
    plan.forEach((p, i) => {
      const bad = !p.newName || /[\\/]/.test(p.newName);
      if (bad) invalid++;
      const key = p.newName.toLowerCase();
      seen.set(key, (seen.get(key) || 0) + 1);
      preview.appendChild(h("tr", {},
        h("td", { class: "num", text: String(i + 1) }),
        h("td", { text: p.item.fileName }),
        h("td", {
          class: "mono",
          text: p.newName,
          style: { color: bad ? "var(--danger)" : p.newName === p.item.fileName ? "var(--fg-faint)" : "var(--ok)" },
        }),
      ));
    });
    for (const n of seen.values()) if (n > 1) dupes++;
    warn.textContent = [
      dupes ? `${dupes} ta takrorlanuvchi nom` : "",
      invalid ? `${invalid} ta yaroqsiz nom` : "",
    ].filter(Boolean).join(" · ");
    return { plan, ok: !dupes && !invalid };
  }

  async function run() {
    const { plan, ok } = render();
    if (!ok) return toast("Avval takror yoki yaroqsiz nomlarni tuzating", { kind: "error" });
    const pairs = plan.filter((p) => p.newName !== p.item.fileName).map((p) => [p.item.path, `${fmt.dirName(p.item.path)}${app.sep}${p.newName}`]);
    if (!pairs.length) return toast("O'zgartiriladigan narsa yo'q", { kind: "warn" });
    try {
      await api.applyRenames(pairs);
      dlg.close(null);
      await panel.reload();
      toast(`${pairs.length} ta fayl nomi o'zgardi`, { kind: "ok", title: "Ommaviy nomlash" });
    } catch (err) {
      toastError(err, "Nomlab bo'lmadi");
    }
  }

  render();
  return dlg.result;
}
