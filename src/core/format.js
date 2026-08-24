const NBSP = " ";

export function toKilo(bytes) {
  const k = Math.ceil(Number(bytes || 0) / 1024);
  return groupDots(k);
}

function groupDots(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const UNITS = ["b", "k", "M", "G", "T", "P"];

export function shortSize(bytes) {
  let n = Number(bytes || 0);
  if (n < 1024) return String(n);
  let u = 0;
  while (n >= 1024 && u < UNITS.length - 1) { n /= 1024; u++; }
  const digits = n >= 100 ? 0 : n >= 10 ? 1 : 2;
  return `${n.toFixed(digits)}${NBSP}${UNITS[u]}`;
}

export function fullBytes(bytes) {
  return `${groupDots(Number(bytes || 0))} bytes`;
}

export function speed(bps) {
  if (!bps) return "—";
  return `${shortSize(bps)}/s`;
}

export function duration(secs) {
  const s = Math.max(0, Math.round(Number(secs) || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  const hrs = Math.floor(m / 60);
  return `${hrs}h ${String(m % 60).padStart(2, "0")}m`;
}

const pad = (n) => String(n).padStart(2, "0");

export function stamp(ms) {
  if (!ms) return "";
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return "";
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function stampFull(ms) {
  if (!ms) return "—";
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function clock(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function today(d = new Date()) {
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

export function percent(done, total) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, (Number(done) / Number(total)) * 100));
}

export function parseSize(text) {
  const m = String(text).trim().match(/^([\d.,]+)\s*([bkmgt]?)b?$/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  if (Number.isNaN(n)) return null;
  const mult = { "": 1, b: 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3, t: 1024 ** 4 };
  return Math.round(n * mult[m[2].toLowerCase()]);
}

export function baseName(path, sep = "/") {
  if (!path) return "";
  const norm = path.replace(/[\\/]+$/, "");
  const i = Math.max(norm.lastIndexOf("/"), norm.lastIndexOf("\\"));
  return i >= 0 ? norm.slice(i + 1) || norm : norm;
}

export function dirName(path) {
  if (!path) return "";
  const norm = path.replace(/[\\/]+$/, "");
  const i = Math.max(norm.lastIndexOf("/"), norm.lastIndexOf("\\"));
  if (i <= 0) return norm.startsWith("/") ? "/" : norm;
  return norm.slice(0, i);
}
