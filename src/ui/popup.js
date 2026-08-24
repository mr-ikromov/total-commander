import { h, svg } from "../core/dom.js";
import { ICONS } from "../core/icons.js";

let current = null;

export function closePopup() {
  if (!current) return;
  current.el.remove();
  current.cleanup?.();
  current = null;
}

export function isPopupOpen() { return !!current; }

export function openPopup(items, opts = {}) {
  closePopup();
  const el = h("div", { class: opts.className || "menu-pop", role: "menu" });
  for (const item of items) {
    if (!item) continue;
    const btn = h("button", {
      class: "menu-item",
      type: "button",
      role: "menuitem",
      disabled: !!item.disabled,
      on: {
        click: () => {
          if (item.disabled) return;
          closePopup();
          item.onClick?.();
        },
      },
    },
      h("span", { class: "menu-item__check" }, item.checked ? svg(ICONS.check) : null),
      h("span", { class: "menu-item__label", text: item.label }),
      item.key ? h("span", { class: "menu-item__key", text: item.key }) : null,
    );
    el.appendChild(btn);
  }

  document.getElementById("overlay-root").appendChild(el);
  document.getElementById("overlay-root").style.pointerEvents = "auto";
  position(el, opts);
  const onDocDown = (e) => { if (!el.contains(e.target) && e.target !== opts.anchor) closePopup(); };
  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePopup(); return; }
    const items = Array.from(el.querySelectorAll(".menu-item:not([disabled])"));
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  };
  const onScroll = () => closePopup();
  setTimeout(() => document.addEventListener("mousedown", onDocDown, true), 0);
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", onScroll);
  current = {
    el,
    cleanup: () => {
      document.removeEventListener("mousedown", onDocDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onScroll);
      const ov = document.getElementById("overlay-root");
      if (!ov.querySelector(".backdrop")) ov.style.pointerEvents = "none";
      opts.onClose?.();
    },
  };
  return el;
}

function position(el, opts) {
  const pad = 8;
  const rect = el.getBoundingClientRect();
  let x = opts.x ?? 0;
  let y = opts.y ?? 0;
  if (opts.anchor) {
    const a = opts.anchor.getBoundingClientRect();
    x = a.left;
    y = a.bottom + 4;
    if (opts.align === "right") x = a.right - rect.width;
  }
  x = Math.max(pad, Math.min(x, window.innerWidth - rect.width - pad));
  if (y + rect.height > window.innerHeight - pad) {
    const above = (opts.anchor?.getBoundingClientRect().top ?? y) - rect.height - 4;
    y = above > pad ? above : Math.max(pad, window.innerHeight - rect.height - pad);
  }
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
}
