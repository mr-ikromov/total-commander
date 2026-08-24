import { App } from "./app.js";

function fatal(err) {
  console.error("Total Commander failed to start", err);
  document.body.innerHTML = `
    <div style="padding:40px;font:14px system-ui;color:#e6e8f2;background:#0d0e14;height:100%;overflow:auto">
      <h2 style="margin:0 0 12px">Total Commander ishga tushmadi</h2>
      <p style="color:#9aa0b8;margin:0 0 16px">
        Bu oyna ish stoli dasturi ichida ishlashi kerak; Rust backend bilan aloqa yo'q.
      </p>
      <pre style="white-space:pre-wrap;color:#ff6b7a;user-select:text">${
        String(err?.stack || err)
      }</pre>
    </div>`;
}

try {
  const app = new App();
  window.__tc = app;
  app.start().catch(fatal);
} catch (err) {
  fatal(err);
}
