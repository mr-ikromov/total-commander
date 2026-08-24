import { h, clear, svg } from "../core/dom.js";
import { ICONS } from "../core/icons.js";
import { openPopup } from "./popup.js";
import { MENUS, HEADER_ACTIONS, prettyKey } from "./commands.js";
import { clock, today } from "../core/format.js";

function openMenu(app, menu, anchor) {
  const items = menu.items.map((id) => {
    const cmd = app.command(id);
    if (!cmd) return null;
    return {
      label: cmd.label,
      key: prettyKey(cmd.key),
      checked: cmd.checked ? cmd.checked() : false,
      disabled: cmd.enabled ? !cmd.enabled() : false,
      onClick: () => app.run(id),
    };
  }).filter(Boolean);
  anchor.setAttribute("aria-expanded", "true");
  openPopup(items, {
    anchor,
    onClose: () => anchor.setAttribute("aria-expanded", "false"),
  });
}

export function renderHeaderActions(app, host) {
  clear(host);
  host.appendChild(buildClock());
  host.appendChild(h("button", {
    class: "hbtn",
    type: "button",
    title: "Menyu",
    "aria-label": "Menyu",
    "aria-haspopup": "menu",
    on: {
      click: (e) => openPopup(
        MENUS.map((m) => ({ label: m.label, onClick: () => openMenu(app, m, e.target.closest("button")) })),
        { anchor: e.currentTarget },
      ),
    },
  }, svg(ICONS.menu)));
  host.appendChild(h("button", {
    class: "hbtn side-switch", type: "button", title: "Panelni almashtirish (Tab)",
    on: { click: () => app.toggleSide() },
  }, svg(ICONS.swap)));
  host.appendChild(h("div", { class: "hsep" }));
  for (const id of HEADER_ACTIONS) {
    const cmd = app.command(id);
    if (!cmd) continue;
    host.appendChild(h("button", {
      class: "hbtn",
      type: "button",
      title: cmd.key ? `${cmd.label} (${prettyKey(cmd.key)})` : cmd.label,
      dataset: { cmd: id },
      "aria-pressed": cmd.checked ? String(cmd.checked()) : null,
      on: { click: () => app.run(id) },
    }, svg(cmd.icon || ICONS.file)));
  }
}

function buildClock() {
  const timeEl = h("span");
  const dateEl = h("span", { class: "hclock__date" });
  const el = h("div", { class: "hclock", title: "Tizim vaqti" }, timeEl, dateEl);
  const tick = () => {
    const now = new Date();
    timeEl.textContent = clock(now);
    dateEl.textContent = today(now);
  };
  tick();
  setInterval(tick, 1000);
  return el;
}

export function refreshToggles(app, host) {
  for (const btn of host.querySelectorAll("[data-cmd]")) {
    const cmd = app.command(btn.dataset.cmd);
    if (cmd?.checked) btn.setAttribute("aria-pressed", String(cmd.checked()));
  }
}
