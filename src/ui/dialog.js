import { h, svg, trapFocus } from "../core/dom.js";
import { ICONS } from "../core/icons.js";

const overlay = () => document.getElementById("overlay-root");
const stack = [];

export function openDialog({
  title,
  icon = ICONS.info,
  size = "md",
  body,
  buttons = [],
  onKeydown,
  closable = true,
} = {}) {
  let resolveFn;
  const result = new Promise((res) => { resolveFn = res; });
  const bodyEl = h("div", { class: "dlg__body" });
  if (body) bodyEl.appendChild(body);
  const footEl = h("div", { class: "dlg__foot" });
  const dlg = h("div", {
    class: "dlg",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": title,
    dataset: { size },
    on: { mousedown: (e) => e.stopPropagation() },
  },
    h("div", { class: "dlg__head" },
      svg(icon),
      h("div", { class: "dlg__title", text: title }),
      closable ? h("button", {
        class: "dlg__x", type: "button", "aria-label": "Yopish",
        on: { click: () => close(null) },
      }, svg(ICONS.x)) : null,
    ),
    bodyEl,
    footEl,
  );

  const back = h("div", {
    class: "backdrop",
    on: {
      mousedown: (e) => { if (closable && e.target === back) close(null); },
    },
  }, dlg);

  const api = { el: dlg, body: bodyEl, foot: footEl, close, result, back };
  footEl.append(...buildButtons(buttons, api));
  const untrap = trapFocus(dlg);
  const keyHandler = (e) => {
    if (stack[stack.length - 1] !== api) return;
    if (onKeydown && onKeydown(e, api) === true) return;
    if (e.key === "Escape" && closable) { e.preventDefault(); e.stopPropagation(); close(null); }
    if (e.key === "Enter" && !e.shiftKey) {
      const target = e.target;
      if (target.tagName === "TEXTAREA" || target.dataset.noEnter === "1") return;
      const def = footEl.querySelector("[data-default='1']");
      if (def && !def.disabled) { e.preventDefault(); e.stopPropagation(); def.click(); }
    }
  };

  document.addEventListener("keydown", keyHandler, true);
  function close(value) {
    if (!back.isConnected) return;
    document.removeEventListener("keydown", keyHandler, true);
    untrap();
    back.remove();
    const i = stack.indexOf(api);
    if (i >= 0) stack.splice(i, 1);
    overlay().style.pointerEvents = stack.length ? "auto" : "none";
    resolveFn(value);
  }

  overlay().appendChild(back);
  overlay().style.pointerEvents = "auto";
  stack.push(api);
  requestAnimationFrame(() => {
    const first = dlg.querySelector("input:not([type=hidden]), textarea, select, [data-autofocus]")
      || footEl.querySelector("[data-default='1']")
      || dlg;
    first.focus?.();
    if (first.select && first.tagName === "INPUT" && first.type === "text") first.select();
  });
  return api;
}

function buildButtons(buttons, api) {
  return buttons.filter(Boolean).map((b) => {
    if (b === "spacer") return h("div", { class: "grow" });
    return h("button", {
      class: ["btn", b.variant ? `btn--${b.variant}` : ""].join(" ").trim(),
      type: "button",
      dataset: { default: b.default ? "1" : "0" },
      disabled: b.disabled || false,
      on: { click: () => b.onClick ? b.onClick(api) : api.close(b.value) },
      ref: (el) => { if (b.ref) b.ref(el); },
    }, b.icon ? svg(b.icon) : null, b.label);
  });
}

export function confirmDialog({
  title = "Tasdiqlash",
  message,
  detail = "",
  okLabel = "OK",
  cancelLabel = "Bekor qilish",
  variant = "primary",
  icon = ICONS.info,
} = {}) {
  const body = h("div", {},
    h("p", { text: message, style: { color: "var(--fg)", fontSize: "13px" } }),
    detail ? h("p", { text: detail }) : null,
  );
  const dlg = openDialog({
    title, icon, size: "sm", body,
    buttons: [
      "spacer",
      { label: cancelLabel, onClick: (a) => a.close(false) },
      { label: okLabel, variant, default: true, onClick: (a) => a.close(true) },
    ],
  });
  return dlg.result;
}

export function promptDialog({
  title = "Kiritish",
  label = "",
  value = "",
  placeholder = "",
  okLabel = "OK",
  icon = ICONS.edit,
  selectRange = null,
  validate = null,
} = {}) {
  let input;
  const errEl = h("div", { style: { color: "var(--danger)", fontSize: "11.5px", minHeight: "16px", marginTop: "4px" } });
  const body = h("div", { class: "field" },
    label ? h("label", { text: label }) : null,
    input = h("input", {
      class: "input input--mono", type: "text", value, placeholder, spellcheck: "false",
      on: { input: () => { errEl.textContent = ""; } },
    }),
    errEl,
  );
  const dlg = openDialog({
    title, icon, size: "sm", body,
    buttons: [
      "spacer",
      { label: "Bekor qilish", onClick: (a) => a.close(null) },
      {
        label: okLabel, variant: "primary", default: true,
        onClick: (a) => {
          const v = input.value.trim();
          const err = validate ? validate(v) : (v ? null : "Qiymat kerak");
          if (err) { errEl.textContent = err; input.focus(); return; }
          a.close(v);
        },
      },
    ],
  });
  requestAnimationFrame(() => {
    input.focus();
    if (selectRange) input.setSelectionRange(selectRange[0], selectRange[1]);
    else input.select();
  });
  return dlg.result;
}
