const wrap = (body, vb = "0 0 24 24") => `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  view: wrap('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10M7 13h6"/>'),
  edit: wrap('<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M14 6l4 4"/>'),
  copy: wrap('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>'),
  move: wrap('<path d="M5 12h13"/><path d="M13 7l5 5-5 5"/><path d="M3 5v14"/>'),
  newFolder: wrap('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v5M9.5 13.5h5"/>'),
  trash: wrap('<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>'),
  rename: wrap('<path d="M4 7V5h16v2"/><path d="M12 5v14"/><path d="M9 19h6"/>'),
  refresh: wrap('<path d="M20 11a8 8 0 1 0-1.6 5.6"/><path d="M20 5v6h-6"/>'),
  reload: wrap('<path d="M4 13a8 8 0 1 0 1.6-5.6"/><path d="M4 19v-6h6"/>'),
  menu: wrap('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  drive: wrap('<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 12h.01M10 12h4"/>'),
  chevronDown: wrap('<path d="M6 9l6 6 6-6"/>'),
  chevronUp: wrap('<path d="M18 15l-6-6-6 6"/>'),
  chevronRight: wrap('<path d="M9 6l6 6-6 6"/>'),
  chevronLeft: wrap('<path d="M15 6l-6 6 6 6"/>'),
  folder: wrap('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  file: wrap('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
  search: wrap('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  filter: wrap('<path d="M3 5h18l-7 8v6l-4 2v-8z"/>'),
  eye: wrap('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>'),
  info: wrap('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  cog: wrap('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 4.6 1.6 1.6 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>'),
  pack: wrap('<path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"/><rect x="2" y="3" width="20" height="5" rx="1"/><path d="M10 12h4"/>'),
  unpack: wrap('<path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"/><rect x="2" y="3" width="20" height="5" rx="1"/><path d="M12 18v-6M9.5 14.5L12 12l2.5 2.5"/>'),
  compare: wrap('<path d="M12 3v18"/><path d="M7 7L3 12l4 5"/><path d="M17 7l4 5-4 5"/>'),
  sync: wrap('<path d="M4 8h13l-3-3"/><path d="M20 16H7l3 3"/>'),
  terminal: wrap('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/>'),
  star: wrap('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'),
  plus: wrap('<path d="M12 5v14M5 12h14"/>'),
  x: wrap('<path d="M6 6l12 12M18 6L6 18"/>'),
  check: wrap('<path d="M4 12.5l5 5L20 6.5"/>'),
  columns: wrap('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>'),
  single: wrap('<rect x="3" y="4" width="18" height="16" rx="2"/>'),
  swap: wrap('<path d="M7 8h13l-3-3"/><path d="M17 16H4l3 3"/>'),
  equal: wrap('<path d="M5 9h14M5 15h14"/>'),
  hash: wrap('<path d="M10 3L8 21M16 3l-2 18M3 9h18M2 15h18"/>'),
  split: wrap('<path d="M12 3v6M12 15v6"/><path d="M8 9h8l-4 6z"/>'),
  props: wrap('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
  select: wrap('<path d="M4 6h10M4 12h10M4 18h6"/><path d="M17 9l2.5 2.5L23 8"/>'),
  invert: wrap('<circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>'),
  home: wrap('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'),
  up: wrap('<path d="M12 20V5"/><path d="M6 11l6-6 6 6"/>'),
  save: wrap('<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M8 3v6h7"/><path d="M8 15h8v6H8z"/>'),
  wrap: wrap('<path d="M4 6h16M4 12h12a3 3 0 1 1 0 6h-3"/><path d="M9 15l-2 3 2 3"/><path d="M4 18h3"/>'),
  binary: wrap('<rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
  bookmark: wrap('<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>'),
  paste: wrap('<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="M9 12h6M9 16h4"/>'),
  cut: wrap('<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 16L18 4M16 16L6 4"/>'),
  lock: wrap('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  moon: wrap('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
};

function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * factor))));
  return `#${ch.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const INK = "#ffffff";
const W = `stroke="${INK}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;

function inkFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return luminance > 0.42 ? "#1d2330" : INK;
}

const GLYPH = {
  code: `<path d="M9.8 11.8 7.6 14l2.2 2.2M14.2 11.8 16.4 14l-2.2 2.2M13 11.1l-2 5.8" ${W} stroke-width="1.35"/>`,
  angle: `<path d="M10.1 11.7 7.7 14l2.4 2.3M13.9 11.7 16.3 14l-2.4 2.3" ${W} stroke-width="1.5"/>`,
  hash: `<path d="M10.5 11.5 9.5 16.7M14.5 11.5l-1 5.2M8.4 13.2h7.2M8 15.1h7.2" ${W} stroke-width="1.15"/>`,
  braces: `<path d="M10.5 11.5c-1.2 0-1 1.4-1 2.5s-.6 1.1-1.1 1.1c.5 0 1.1 0 1.1 1.1s-.2 2.4 1 2.4M13.5 11.5c1.2 0 1 1.4 1 2.5s.6 1.1 1.1 1.1c-.5 0-1.1 0-1.1 1.1s.2 2.4-1 2.4" ${W} stroke-width="1.15"/>`,
  lines: `<path d="M8.4 12.3h7.2M8.4 14.5h7.2M8.4 16.7h4.6" ${W} stroke-width="1.35"/>`,
  grid: `<rect x="7.9" y="11.7" width="8.2" height="5.8" rx=".7" ${W} stroke-width="1.1"/><path d="M7.9 13.9h8.2M12 11.7v5.8" ${W} stroke-width="1.1"/>`,
  chart: `<path d="M8.7 17.3v-2.9M12 17.3v-5.4M15.3 17.3v-3.8" ${W} stroke-width="1.7"/>`,
  image: `<rect x="7.7" y="11.6" width="8.6" height="6" rx=".9" ${W} stroke-width="1.1"/><circle cx="10.2" cy="13.7" r=".95" fill="#ffffff" stroke="none"/><path d="M8 16.6l2.6-2.3 2.1 1.8 1.6-1.3 2 1.8" ${W} stroke-width="1.1"/>`,
  audio: `<path d="M11.3 16.5v-4.8l4.3-.9v4.8" ${W} stroke-width="1.25"/><circle cx="10.1" cy="16.6" r="1.25" fill="#ffffff" stroke="none"/><circle cx="14.4" cy="15.7" r="1.25" fill="#ffffff" stroke="none"/>`,
  video: `<circle cx="12" cy="14.5" r="3.5" ${W} stroke-width="1.2"/><path d="M10.9 12.8l3 1.7-3 1.7z" fill="#ffffff" stroke="none"/>`,
  archive: `<path d="M11.15 10.2h1.7v1.7h-1.7zM11.15 11.9h1.7v1.7h-1.7z" fill="#ffffff" stroke="none"/><rect x="10.7" y="13.8" width="2.6" height="3.6" rx=".9" ${W} stroke-width="1.2"/><path d="M12 15.3v.9" ${W} stroke-width="1"/>`,
  pdf: `<path d="M9.1 17.4v-5.6h1.9a1.5 1.5 0 0 1 0 3H9.1M13.4 17.4v-5.6h1.6a1.6 1.6 0 0 1 1.6 1.6v2.4a1.6 1.6 0 0 1-1.6 1.6z" ${W} stroke-width="1.15"/>`,
  gear: `<circle cx="12" cy="14.4" r="1.55" ${W} stroke-width="1.2"/><path d="M12 10.7v1.2M12 16.9v1.2M8.3 14.4h1.2M14.5 14.4h1.2M9.4 11.8l.85.85M13.75 16.15l.85.85M14.6 11.8l-.85.85M10.25 16.15l-.85.85" ${W} stroke-width="1.1"/>`,
  db: `<ellipse cx="12" cy="12.1" rx="3.5" ry="1.35" ${W} stroke-width="1.2"/><path d="M8.5 12.1v4.4c0 .75 1.57 1.35 3.5 1.35s3.5-.6 3.5-1.35v-4.4" ${W} stroke-width="1.2"/><path d="M8.5 14.3c0 .75 1.57 1.35 3.5 1.35s3.5-.6 3.5-1.35" ${W} stroke-width="1.05"/>`,
  font: `<path d="M9.2 17.4 12 11.2l2.8 6.2M10.25 15.4h3.5" ${W} stroke-width="1.35"/>`,
  terminal: `<path d="M8.5 12.2l2.3 2.1-2.3 2.1M12.4 16.6h3.2" ${W} stroke-width="1.35"/>`,
  markdown: `<path d="M8 17.2v-5.4l2.1 2.6 2.1-2.6v5.4M15.1 11.8v4.1M13.7 14.6l1.4 1.6 1.4-1.6" ${W} stroke-width="1.15"/>`,
  git: `<circle cx="9.7" cy="12.3" r="1.25" fill="#ffffff" stroke="none"/><circle cx="9.7" cy="16.7" r="1.25" fill="#ffffff" stroke="none"/><circle cx="14.4" cy="13.6" r="1.25" fill="#ffffff" stroke="none"/><path d="M9.7 13.55v1.9M9.7 15.6c0-1.15 1.1-1.6 2.5-1.6h.95" ${W} stroke-width="1.1"/>`,
  disk: `<circle cx="12" cy="14.4" r="3.5" ${W} stroke-width="1.2"/><circle cx="12" cy="14.4" r="1.05" fill="#ffffff" stroke="none"/>`,
  lock: `<rect x="9.4" y="14" width="5.2" height="3.8" rx="1" ${W} stroke-width="1.2"/><path d="M10.6 14v-1.3a1.4 1.4 0 0 1 2.8 0V14" ${W} stroke-width="1.2"/>`,
  book: `<path d="M8.2 11.9h4a1.6 1.6 0 0 1 1.6 1.6v4.1a1.3 1.3 0 0 0-1.3-1.3H8.2zM15.8 11.9h-2a1.6 1.6 0 0 0-1.6 1.6" ${W} stroke-width="1.15"/>`,
  vector: `<path d="M8.6 16.8 12 11.6l3.4 5.2z" ${W} stroke-width="1.2"/>`,
  cube: `<path d="M12 11.3l3.5 1.85v3.7L12 18.7l-3.5-1.85v-3.7z" ${W} stroke-width="1.15"/><path d="M12 15v3.7M12 15l3.5-1.85M12 15 8.5 13.15" ${W} stroke-width="1.05"/>`,
  plain: `<path d="M8.6 12.6h6.8M8.6 14.6h6.8M8.6 16.6h3.8" ${W} stroke-width="1.2"/>`,
};

const TYPES = {
  html: ["#e44d26", "angle"], htm: ["#e44d26", "angle"], xhtml: ["#e44d26", "angle"],
  vue: ["#41b883", "angle"], svelte: ["#ff3e00", "angle"], astro: ["#ff5d01", "angle"],
  ejs: ["#a91e50", "angle"], hbs: ["#f0772b", "angle"], pug: ["#a86454", "angle"],
  css: ["#2965f1", "hash"], scss: ["#cd6799", "hash"], sass: ["#cd6799", "hash"],
  less: ["#1d365d", "hash"], styl: ["#b3d107", "hash"],
  js: ["#f7df1e", "code"], mjs: ["#f7df1e", "code"], cjs: ["#f7df1e", "code"],
  jsx: ["#61dafb", "angle"], ts: ["#3178c6", "code"], tsx: ["#3178c6", "angle"],
  py: ["#3776ab", "code"], pyw: ["#3776ab", "code"], pyi: ["#3776ab", "code"],
  rs: ["#ce422b", "gear"], go: ["#00add8", "code"], java: ["#e76f00", "code"],
  class: ["#e76f00", "cube"], kt: ["#7f52ff", "code"], kts: ["#7f52ff", "code"],
  c: ["#659ad2", "code"], h: ["#659ad2", "code"], cpp: ["#00599c", "code"],
  cxx: ["#00599c", "code"], cc: ["#00599c", "code"], hpp: ["#00599c", "code"],
  cs: ["#68217a", "code"], fs: ["#378bba", "code"], vb: ["#512bd4", "code"],
  php: ["#777bb4", "code"], rb: ["#cc342d", "code"], erb: ["#cc342d", "angle"],
  swift: ["#fa7343", "code"], dart: ["#0175c2", "code"], lua: ["#000080", "code"],
  pl: ["#39457e", "code"], pm: ["#39457e", "code"], r: ["#276dc3", "code"],
  scala: ["#dc322f", "code"], clj: ["#5881d8", "code"], ex: ["#6e4a7e", "code"],
  exs: ["#6e4a7e", "code"], hs: ["#5e5086", "code"], jl: ["#9558b2", "code"],
  zig: ["#f7a41d", "code"], nim: ["#ffe953", "code"], asm: ["#6e4c13", "code"],
  s: ["#6e4c13", "code"], m: ["#438eff", "code"], mm: ["#438eff", "code"],
  sh: ["#4eaa25", "terminal"], bash: ["#4eaa25", "terminal"], zsh: ["#4eaa25", "terminal"],
  fish: ["#4eaa25", "terminal"], ps1: ["#012456", "terminal"], bat: ["#4d4d4d", "terminal"],
  cmd: ["#4d4d4d", "terminal"], nu: ["#3aa675", "terminal"],
  json: ["#cbcb41", "braces"], json5: ["#cbcb41", "braces"], jsonc: ["#cbcb41", "braces"],
  yml: ["#cb171e", "braces"], yaml: ["#cb171e", "braces"], toml: ["#9c4221", "braces"],
  ini: ["#6d8086", "braces"], cfg: ["#6d8086", "braces"], conf: ["#6d8086", "braces"],
  env: ["#ecd53f", "braces"], properties: ["#6d8086", "braces"],
  xml: ["#f1662a", "angle"], plist: ["#f1662a", "angle"], gradle: ["#02303a", "braces"],
  lock: ["#8b8b8b", "lock"],
  txt: ["#8a99a8", "lines"], log: ["#78909c", "lines"], nfo: ["#8a99a8", "lines"],
  rtf: ["#5b7c99", "lines"], tex: ["#3d6117", "lines"], bib: ["#3d6117", "lines"],
  md: ["#519aba", "markdown"], markdown: ["#519aba", "markdown"], mdx: ["#519aba", "markdown"],
  rst: ["#519aba", "markdown"], adoc: ["#519aba", "markdown"],
  pdf: ["#e5252a", "pdf"],
  doc: ["#2b579a", "lines"], docx: ["#2b579a", "lines"], odt: ["#2b579a", "lines"],
  pages: ["#2b579a", "lines"], epub: ["#8bc34a", "book"], mobi: ["#8bc34a", "book"],
  azw: ["#8bc34a", "book"], djvu: ["#8bc34a", "book"], fb2: ["#8bc34a", "book"],
  xls: ["#217346", "grid"], xlsx: ["#217346", "grid"], xlsm: ["#217346", "grid"],
  ods: ["#217346", "grid"], numbers: ["#217346", "grid"],
  csv: ["#1e7a45", "grid"], tsv: ["#1e7a45", "grid"],
  ppt: ["#d24726", "chart"], pptx: ["#d24726", "chart"], odp: ["#d24726", "chart"],
  key: ["#d24726", "chart"],
  png: ["#4dabf7", "image"], jpg: ["#4dabf7", "image"], jpeg: ["#4dabf7", "image"],
  gif: ["#40c4a7", "image"], bmp: ["#4dabf7", "image"], webp: ["#4dabf7", "image"],
  tif: ["#4dabf7", "image"], tiff: ["#4dabf7", "image"], avif: ["#4dabf7", "image"],
  heic: ["#4dabf7", "image"], heif: ["#4dabf7", "image"], ico: ["#5c9ded", "image"],
  raw: ["#7986cb", "image"], cr2: ["#7986cb", "image"], nef: ["#7986cb", "image"],
  arw: ["#7986cb", "image"], dng: ["#7986cb", "image"],
  svg: ["#ffb13b", "vector"], eps: ["#ffb13b", "vector"], ai: ["#ff9a00", "vector"],
  psd: ["#31a8ff", "image"], xcf: ["#5c5543", "image"], fig: ["#a259ff", "vector"],
  sketch: ["#fdb300", "vector"], blend: ["#ea7600", "cube"], obj: ["#8d6e63", "cube"],
  fbx: ["#8d6e63", "cube"], stl: ["#8d6e63", "cube"], gltf: ["#8d6e63", "cube"],
  glb: ["#8d6e63", "cube"],
  mp3: ["#c77df0", "audio"], wav: ["#c77df0", "audio"], flac: ["#b06ee0", "audio"],
  ogg: ["#c77df0", "audio"], m4a: ["#c77df0", "audio"], aac: ["#c77df0", "audio"],
  wma: ["#c77df0", "audio"], opus: ["#c77df0", "audio"], aiff: ["#c77df0", "audio"],
  mid: ["#9c6ade", "audio"], midi: ["#9c6ade", "audio"],
  mp4: ["#f0863e", "video"], mkv: ["#f0863e", "video"], avi: ["#f0863e", "video"],
  mov: ["#f0863e", "video"], webm: ["#f0863e", "video"], wmv: ["#f0863e", "video"],
  flv: ["#f0863e", "video"], m4v: ["#f0863e", "video"], mpg: ["#f0863e", "video"],
  mpeg: ["#f0863e", "video"], "3gp": ["#f0863e", "video"], vob: ["#f0863e", "video"],
  srt: ["#ff8a65", "lines"], vtt: ["#ff8a65", "lines"], ass: ["#ff8a65", "lines"],
  zip: ["#f0a32e", "archive"], rar: ["#a45ee5", "archive"], "7z": ["#5c9ded", "archive"],
  tar: ["#c98a2e", "archive"], gz: ["#c98a2e", "archive"], tgz: ["#c98a2e", "archive"],
  bz2: ["#c98a2e", "archive"], xz: ["#c98a2e", "archive"], zst: ["#c98a2e", "archive"],
  lz: ["#c98a2e", "archive"], lzma: ["#c98a2e", "archive"], cab: ["#c98a2e", "archive"],
  arj: ["#c98a2e", "archive"], jar: ["#e76f00", "archive"], war: ["#e76f00", "archive"],
  apk: ["#3ddc84", "archive"], xpi: ["#ff7139", "archive"], crx: ["#4285f4", "archive"],
  exe: ["#ef5350", "gear"], msi: ["#ef5350", "gear"], com: ["#ef5350", "gear"],
  dll: ["#9e9e9e", "gear"], so: ["#9e9e9e", "gear"], dylib: ["#9e9e9e", "gear"],
  o: ["#9e9e9e", "cube"], a: ["#9e9e9e", "cube"], lib: ["#9e9e9e", "cube"],
  appimage: ["#26a69a", "gear"], deb: ["#a80030", "gear"], rpm: ["#ee0000", "gear"],
  pkg: ["#8e8e93", "gear"], dmg: ["#8e8e93", "disk"], run: ["#26a69a", "gear"],
  bin: ["#78909c", "cube"], apk_: ["#3ddc84", "gear"],
  iso: ["#6f7dbf", "disk"], img: ["#6f7dbf", "disk"], vhd: ["#6f7dbf", "disk"],
  vmdk: ["#6f7dbf", "disk"], qcow2: ["#6f7dbf", "disk"],
  sql: ["#336791", "db"], db: ["#336791", "db"], sqlite: ["#0f80cc", "db"],
  sqlite3: ["#0f80cc", "db"], mdb: ["#a4373a", "db"], accdb: ["#a4373a", "db"],
  dbf: ["#336791", "db"], parquet: ["#50abdb", "db"],
  ttf: ["#607d8b", "font"], otf: ["#607d8b", "font"], woff: ["#607d8b", "font"],
  woff2: ["#607d8b", "font"], eot: ["#607d8b", "font"], fon: ["#607d8b", "font"],
  pem: ["#f9a825", "lock"], crt: ["#f9a825", "lock"], cer: ["#f9a825", "lock"],
  pfx: ["#f9a825", "lock"], p12: ["#f9a825", "lock"], gpg: ["#f9a825", "lock"],
  asc: ["#f9a825", "lock"], kdbx: ["#f9a825", "lock"], keystore: ["#f9a825", "lock"],
};

const BY_NAME = {
  ".gitignore": ["#f05032", "git"], ".gitattributes": ["#f05032", "git"],
  ".gitmodules": ["#f05032", "git"], ".gitkeep": ["#f05032", "git"],
  ".dockerignore": ["#2496ed", "cube"], dockerfile: ["#2496ed", "cube"],
  makefile: ["#6d8086", "gear"], cmakelists: ["#064f8c", "gear"],
  ".editorconfig": ["#6d8086", "braces"], ".npmrc": ["#cb3837", "braces"],
  ".env": ["#ecd53f", "braces"], ".bashrc": ["#4eaa25", "terminal"],
  ".zshrc": ["#4eaa25", "terminal"], ".profile": ["#4eaa25", "terminal"],
  license: ["#8a99a8", "lines"], readme: ["#519aba", "markdown"],
  changelog: ["#519aba", "markdown"],
};

function hashedColor(ext) {
  let h = 0;
  for (let i = 0; i < ext.length; i++) h = (h * 31 + ext.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const sat = 52 + (h >> 9) % 18;
  const light = 46 + (h >> 17) % 10;
  return hslToHex(hue, sat, light);
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return `#${[f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function paper(color, glyph) {
  const ink = inkFor(color);
  const mark = (GLYPH[glyph] || GLYPH.plain).split(INK).join(ink);
  return `<svg viewBox="0 0 24 24" class="fico fico--type" aria-hidden="true" focusable="false">
    <path d="M6.4 2.6h7L19 8.2V20a1.6 1.6 0 0 1-1.6 1.6H6.4A1.6 1.6 0 0 1 4.8 20V4.2a1.6 1.6 0 0 1 1.6-1.6Z" fill="${color}"/>
    <path d="M13.4 2.6 19 8.2h-4a1.6 1.6 0 0 1-1.6-1.6Z" fill="${shade(color, 0.68)}"/>
    ${mark}
  </svg>`;
}

const FOLDER = `<svg viewBox="0 0 24 24" class="fico fico--type" aria-hidden="true" focusable="false">
  <path d="M2.6 7.4a2.2 2.2 0 0 1 2.2-2.2h4a2.2 2.2 0 0 1 1.56.64l1.2 1.2a2.2 2.2 0 0 0 1.56.64h6.08a2.2 2.2 0 0 1 2.2 2.2v8.3a2.2 2.2 0 0 1-2.2 2.2H4.8a2.2 2.2 0 0 1-2.2-2.2Z" fill="#2f8fe0"/>
  <path d="M2.6 10.3h18.8v7.88a2.2 2.2 0 0 1-2.2 2.2H4.8a2.2 2.2 0 0 1-2.2-2.2Z" fill="#5fb6f7"/>
  <path d="M2.6 10.3h18.8v1.05H2.6Z" fill="#7cc6fa"/>
</svg>`;

const FOLDER_UP = `<svg viewBox="0 0 24 24" class="fico fico--type" aria-hidden="true" focusable="false">
  <path d="M2.6 7.4a2.2 2.2 0 0 1 2.2-2.2h4a2.2 2.2 0 0 1 1.56.64l1.2 1.2a2.2 2.2 0 0 0 1.56.64h6.08a2.2 2.2 0 0 1 2.2 2.2v8.3a2.2 2.2 0 0 1-2.2 2.2H4.8a2.2 2.2 0 0 1-2.2-2.2Z" fill="#5c6684"/>
  <path d="M2.6 10.3h18.8v7.88a2.2 2.2 0 0 1-2.2 2.2H4.8a2.2 2.2 0 0 1-2.2-2.2Z" fill="#8892af"/>
  <path d="M12 17.6v-4.4M9.8 15.2 12 13l2.2 2.2" stroke="#ffffff" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const LINK_BADGE = `<path d="M15.6 17.4h3.6M17.6 15.8l1.8 1.6-1.8 1.6" stroke="#ffffff" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`;

const nodeCache = new Map();

function nodeFrom(markup) {
  let tpl = nodeCache.get(markup);
  if (!tpl) {
    tpl = document.createElement("template");
    tpl.innerHTML = markup.trim();
    nodeCache.set(markup, tpl);
  }
  return tpl.content.firstElementChild.cloneNode(true);
}

function typeOf(entry) {
  const name = (entry.fileName || "").toLowerCase();
  if (BY_NAME[name]) return BY_NAME[name];
  const ext = (entry.ext || "").toLowerCase();
  if (ext && TYPES[ext]) return TYPES[ext];
  const stem = name.replace(/\.[^.]+$/, "");
  if (BY_NAME[stem]) return BY_NAME[stem];
  return ext ? [hashedColor(ext), "plain"] : ["#8a99a8", "plain"];
}

function fileIconMarkup(entry) {
  if (entry.fileName === "..") return FOLDER_UP;
  if (entry.isDir) return FOLDER;
  const [color, glyph] = typeOf(entry);
  return paper(color, glyph);
}

export function fileIconNode(entry) {
  const node = nodeFrom(fileIconMarkup(entry));
  if (entry.isSymlink) node.insertAdjacentHTML("beforeend", LINK_BADGE);
  return node;
}
