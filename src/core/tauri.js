function runtime() {
  const t = globalThis.__TAURI__;
  if (!t) {
    throw new Error(
      "Tauri ishlash muhiti mavjud emas — bu sahifani ish stoli dasturi yuklashi kerak.",
    );
  }
  return t;
}

export const invoke = (cmd, args) => runtime().core.invoke(cmd, args);
export const convertFileSrc = (path) => runtime().core.convertFileSrc(path);
export const listen = (event, handler) => runtime().event.listen(event, handler);
export const currentWindow = () => runtime().window.getCurrentWindow();
