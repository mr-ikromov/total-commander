import { invoke, listen } from "./tauri.js";

let seq = 0;
export const newJobId = () => `job-${Date.now().toString(36)}-${(seq++).toString(36)}`;

const call = (cmd, args) => invoke(cmd, args);

export const listDir = (path, showHidden) => call("list_dir", { path, showHidden });
export const statPath = (path) => call("stat_path", { path });
export const getDrives = () => call("get_drives");
export const volumeInfo = (path) => call("volume_info", { path });
export const dirStats = (path) => call("dir_stats", { path });
export const pathExists = (path) => call("path_exists", { path });
export const joinPath = (base, child) => call("join_path", { base, child });
export const createDir = (path) => call("create_dir", { path });
export const createFile = (path) => call("create_file", { path });
export const renamePath = (from, to) => call("rename_path", { from, to });
export const applyRenames = (plan) => call("apply_renames", { plan });
export const copyItems = (req) => call("copy_items", { req });
export const moveItems = (req) => call("move_items", { req });
export const deleteItems = (jobId, paths, toTrash) => call("delete_items", { jobId, paths, toTrash });
export const cancelJob = (jobId) => call("cancel_job", { jobId });

export function makeOpRequest(sources, targetDir, opts = {}) {
  return {
    jobId: opts.jobId || newJobId(),
    sources,
    targetDir,
    renameTo: opts.renameTo ?? null,
    conflict: opts.conflict || "ask",
    preserveTimes: opts.preserveTimes ?? true,
  };
}

export const findFiles = (query) => call("find_files", { query });

export function makeSearchQuery(roots, opts = {}) {
  return {
    jobId: opts.jobId || newJobId(),
    roots,
    nameMask: opts.nameMask ?? "",
    content: opts.content ?? "",
    useRegex: opts.useRegex ?? false,
    caseSensitive: opts.caseSensitive ?? false,
    wholeWords: opts.wholeWords ?? false,
    includeHidden: opts.includeHidden ?? false,
    maxDepth: opts.maxDepth ?? 0,
    minSize: opts.minSize ?? null,
    maxSize: opts.maxSize ?? null,
    newerThan: opts.newerThan ?? null,
    olderThan: opts.olderThan ?? null,
    maxResults: opts.maxResults ?? 20000,
  };
}

export const archiveIsSupported = (path) => call("archive_is_supported", { path });
export const archiveList = (path) => call("archive_list", { path });
export const archiveExtract = (jobId, archivePath, targetDir, only = []) => call("archive_extract", { jobId, archivePath, targetDir, only });
export const archiveCreate = (jobId, archivePath, sources, baseDir, level = 6) => call("archive_create", { jobId, archivePath, sources, baseDir, level });
export const readTextChunk = (path, offset = 0, maxBytes = 1024 * 1024) => call("read_text_chunk", { path, offset, maxBytes });
export const readHexChunk = (path, offset = 0, maxBytes = 64 * 1024) => call("read_hex_chunk", { path, offset, maxBytes });
export const writeTextFile = (path, content, lineEnding = "LF") => call("write_text_file", { path, content, lineEnding });
export const fileChecksum = (path, algo) => call("file_checksum", { path, algo });
export const compareFiles = (left, right) => call("compare_files", { left, right });
export const compareDirs = (left, right, recursive, byContent) => call("compare_dirs", { left, right, recursive, byContent });
export const splitFile = (path, targetDir, partSize) => call("split_file", { path, targetDir, partSize });
export const combineFiles = (firstPart, target) => call("combine_files", { firstPart, target });
export const openPath = (path) => call("open_path", { path });
export const revealInManager = (path) => call("reveal_in_manager", { path });
export const openTerminal = (cwd) => call("open_terminal", { cwd });
export const systemInfo = () => call("system_info");
export const clipboardWrite = (text) => call("clipboard_write_text", { text });
export const loadSettings = () => call("load_settings");
export const saveSettings = (data) => call("save_settings", { data });
export const onProgress = (fn) => listen("fs://progress", (e) => fn(e.payload));
export const onSearchHits = (fn) => listen("search://hits", (e) => fn(e.payload));
export const onSearchProgress = (fn) => listen("search://progress", (e) => fn(e.payload));
export const onSearchDone = (fn) => listen("search://done", (e) => fn(e.payload));
