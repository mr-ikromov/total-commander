use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FileEntry {
    pub(crate) path: String,

    pub(crate) name: String,

    pub(crate) ext: String,

    pub(crate) file_name: String,
    pub(crate) size: u64,

    pub(crate) modified: i64,
    pub(crate) created: i64,
    pub(crate) accessed: i64,
    pub(crate) is_dir: bool,
    pub(crate) is_symlink: bool,
    pub(crate) is_hidden: bool,

    pub(crate) attrs: String,

    pub(crate) perms: String,
    pub(crate) owner: String,

    pub(crate) link_target: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Listing {
    pub(crate) path: String,

    pub(crate) parent: Option<String>,
    pub(crate) entries: Vec<FileEntry>,
    pub(crate) total_files: usize,
    pub(crate) total_dirs: usize,
    pub(crate) total_size: u64,

    pub(crate) warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DriveInfo {
    pub(crate) path: String,

    pub(crate) label: String,
    pub(crate) name: String,
    pub(crate) fs: String,
    pub(crate) total: u64,
    pub(crate) free: u64,
    pub(crate) is_removable: bool,
    pub(crate) kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProgressEvent {
    pub(crate) job_id: String,
    pub(crate) kind: String,
    pub(crate) current_file: String,
    pub(crate) target_file: String,
    pub(crate) files_done: u64,
    pub(crate) files_total: u64,
    pub(crate) bytes_done: u64,
    pub(crate) bytes_total: u64,

    pub(crate) file_bytes_done: u64,
    pub(crate) file_bytes_total: u64,
    pub(crate) speed_bps: u64,
    pub(crate) eta_secs: u64,
    pub(crate) done: bool,
    pub(crate) cancelled: bool,
    pub(crate) errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OpRequest {
    pub(crate) job_id: String,
    pub(crate) sources: Vec<String>,
    pub(crate) target_dir: String,

    pub(crate) rename_to: Option<String>,

    pub(crate) conflict: String,
    pub(crate) preserve_times: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SearchQuery {
    pub(crate) job_id: String,
    pub(crate) roots: Vec<String>,

    pub(crate) name_mask: String,
    pub(crate) content: String,
    pub(crate) use_regex: bool,
    pub(crate) case_sensitive: bool,
    pub(crate) whole_words: bool,
    pub(crate) include_hidden: bool,
    pub(crate) max_depth: usize,
    pub(crate) min_size: Option<u64>,
    pub(crate) max_size: Option<u64>,
    pub(crate) newer_than: Option<i64>,
    pub(crate) older_than: Option<i64>,
    pub(crate) max_results: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SearchHit {
    pub(crate) path: String,
    pub(crate) file_name: String,
    pub(crate) size: u64,
    pub(crate) modified: i64,
    pub(crate) is_dir: bool,
    pub(crate) line_no: Option<usize>,
    pub(crate) line_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ArchiveEntry {
    pub(crate) path: String,
    pub(crate) size: u64,
    pub(crate) packed_size: u64,
    pub(crate) is_dir: bool,
    pub(crate) modified: i64,
    pub(crate) crc: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TextChunk {
    pub(crate) content: String,
    pub(crate) encoding: String,
    pub(crate) total_bytes: u64,
    pub(crate) offset: u64,
    pub(crate) read_bytes: u64,
    pub(crate) eof: bool,
    pub(crate) is_binary: bool,
    pub(crate) line_ending: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DirStats {
    pub(crate) files: u64,
    pub(crate) dirs: u64,
    pub(crate) bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CompareRow {
    pub(crate) left: Option<FileEntry>,
    pub(crate) right: Option<FileEntry>,

    pub(crate) status: String,
}
