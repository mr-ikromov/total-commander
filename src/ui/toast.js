import { h } from "../core/dom.js";

const root = () => document.getElementById("toast-root");

export function toast(message, { title = "", kind = "info", timeout = 4200 } = {}) {
  const el = h("div", { class: "toast", dataset: { kind } },
    title ? h("div", { class: "toast__title", text: title }) : null,
    h("div", { class: "toast__body", text: String(message) }),
  );
  root().appendChild(el);
  const close = () => {
    if (!el.isConnected) return;
    el.dataset.closing = "1";
    setTimeout(() => el.remove(), 160);
  };
  el.addEventListener("click", close);
  if (timeout) setTimeout(close, timeout);
  return close;
}

export const toastError = (e, title = "Xatolik") => toast(e?.message ?? String(e), { kind: "error", title, timeout: 7000 });
