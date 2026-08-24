use crate::model::{DirStats, DriveInfo, FileEntry, Listing};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub(crate) fn to_millis(t: std::io::Result<SystemTime>) -> i64 {
    t.ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub(crate) fn split_name(file_name: &str, is_dir: bool) -> (String, String) {
    if is_dir {
        return (file_name.to_string(), String::new());
    }
    match file_name.rfind('.') {
        Some(0) | None => (file_name.to_string(), String::new()),
        Some(idx) => (
            file_name[..idx].to_string(),
            file_name[idx + 1..].to_string(),
        ),
    }
}

#[cfg(unix)]
fn perm_string(md: &fs::Metadata) -> String {
    use std::os::unix::fs::PermissionsExt;
    let m = md.permissions().mode();
    let bit = |mask: u32, ch: char| if m & mask != 0 { ch } else { '-' };
    format!(
        "{}{}{}{}{}{}{}{}{}",
        bit(0o400, 'r'),
        bit(0o200, 'w'),
        bit(0o100, 'x'),
        bit(0o040, 'r'),
        bit(0o020, 'w'),
        bit(0o010, 'x'),
        bit(0o004, 'r'),
        bit(0o002, 'w'),
        bit(0o001, 'x')
    )
}

#[cfg(not(unix))]
fn perm_string(_md: &fs::Metadata) -> String {
    String::new()
}

#[cfg(unix)]
fn owner_of(md: &fs::Metadata) -> String {
    use std::os::unix::fs::MetadataExt;
    format!("{}:{}", md.uid(), md.gid())
}

#[cfg(not(unix))]
fn owner_of(_md: &fs::Metadata) -> String {
    String::new()
}

#[cfg(windows)]
fn attr_string(md: &fs::Metadata) -> (String, bool) {
    use std::os::windows::fs::MetadataExt;
    const READONLY: u32 = 0x1;
    const HIDDEN: u32 = 0x2;
    const SYSTEM: u32 = 0x4;
    const ARCHIVE: u32 = 0x20;
    let a = md.file_attributes();
    let bit = |mask: u32, ch: char| if a & mask != 0 { ch } else { '-' };
    (
        format!(
            "{}{}{}{}",
            bit(READONLY, 'r'),
            bit(HIDDEN, 'h'),
            bit(SYSTEM, 's'),
            bit(ARCHIVE, 'a')
        ),
        a & HIDDEN != 0 || a & SYSTEM != 0,
    )
}

#[cfg(not(windows))]
fn attr_string(md: &fs::Metadata) -> (String, bool) {
    let ro = md.permissions().readonly();
    (format!("{}---", if ro { 'r' } else { '-' }), false)
}

pub(crate) fn entry_from_path(path: &Path) -> std::io::Result<FileEntry> {
    let sym_md = fs::symlink_metadata(path)?;
    let is_symlink = sym_md.file_type().is_symlink();

    let md = if is_symlink {
        fs::metadata(path).unwrap_or_else(|_| sym_md.clone())
    } else {
        sym_md.clone()
    };

    let file_name = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());
    let is_dir = md.is_dir();
    let (name, ext) = split_name(&file_name, is_dir);
    let (attrs, win_hidden) = attr_string(&md);
    let is_hidden = win_hidden || file_name.starts_with('.');

    Ok(FileEntry {
        path: path.to_string_lossy().to_string(),
        name,
        ext,
        file_name,
        size: if is_dir { 0 } else { md.len() },
        modified: to_millis(md.modified()),
        created: to_millis(md.created()),
        accessed: to_millis(md.accessed()),
        is_dir,
        is_symlink,
        is_hidden,
        attrs,
        perms: perm_string(&md),
        owner: owner_of(&md),
        link_target: if is_symlink {
            fs::read_link(path)
                .ok()
                .map(|p| p.to_string_lossy().to_string())
        } else {
            None
        },
    })
}

pub(crate) fn normalize(path: &str) -> PathBuf {
    let p = PathBuf::from(path);
    dunce::canonicalize(&p).unwrap_or(p)
}

pub(crate) fn list_dir(path: &str, show_hidden: bool) -> Result<Listing, String> {
    let dir = normalize(path);
    if !dir.is_dir() {
        return Err(format!("Papka emas: {}", dir.display()));
    }
    let rd = fs::read_dir(&dir).map_err(|e| format!("{}: {}", dir.display(), e))?;

    let mut entries = Vec::with_capacity(256);
    let mut warnings = Vec::new();
    let (mut total_files, mut total_dirs, mut total_size) = (0usize, 0usize, 0u64);

    for item in rd {
        let item = match item {
            Ok(i) => i,
            Err(e) => {
                warnings.push(e.to_string());
                continue;
            }
        };
        match entry_from_path(&item.path()) {
            Ok(e) => {
                if e.is_hidden && !show_hidden {
                    continue;
                }
                if e.is_dir {
                    total_dirs += 1;
                } else {
                    total_files += 1;
                    total_size += e.size;
                }
                entries.push(e);
            }
            Err(e) => warnings.push(format!("{}: {}", item.path().display(), e)),
        }
    }

    Ok(Listing {
        path: dir.to_string_lossy().to_string(),
        parent: dir.parent().map(|p| p.to_string_lossy().to_string()),
        entries,
        total_files,
        total_dirs,
        total_size,
        warnings,
    })
}

pub(crate) fn dir_stats(path: &str) -> DirStats {
    let mut s = DirStats {
        files: 0,
        dirs: 0,
        bytes: 0,
    };
    for e in walkdir::WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if e.file_type().is_dir() {
            s.dirs += 1;
        } else if let Ok(md) = e.metadata() {
            s.files += 1;
            s.bytes += md.len();
        }
    }

    s.dirs = s.dirs.saturating_sub(1);
    s
}

#[cfg(windows)]
fn extra_roots() -> Vec<DriveInfo> {
    Vec::new()
}

#[cfg(not(windows))]
fn extra_roots() -> Vec<DriveInfo> {
    let mut out = Vec::new();
    if let Some(home) = std::env::var_os("HOME") {
        let p = PathBuf::from(home);
        if p.is_dir() {
            out.push(DriveInfo {
                path: p.to_string_lossy().to_string(),
                label: "~".into(),
                name: "Home".into(),
                fs: String::new(),
                total: 0,
                free: 0,
                is_removable: false,
                kind: "home".into(),
            });
        }
    }
    out
}

pub(crate) fn drives() -> Vec<DriveInfo> {
    use sysinfo::Disks;
    let disks = Disks::new_with_refreshed_list();
    let mut out: Vec<DriveInfo> = Vec::new();

    for d in disks.list() {
        let mount = d.mount_point().to_string_lossy().to_string();

        if mount.starts_with("/snap")
            || mount.starts_with("/proc")
            || mount.starts_with("/sys")
            || mount.starts_with("/run/snapd")
            || mount.starts_with("/var/lib/docker")
        {
            continue;
        }
        if out.iter().any(|x| x.path == mount) {
            continue;
        }
        let label = if cfg!(windows) {
            mount.clone()
        } else if mount == "/" {
            "/".to_string()
        } else {
            mount
                .rsplit('/')
                .next()
                .filter(|s| !s.is_empty())
                .unwrap_or("/")
                .to_string()
        };
        out.push(DriveInfo {
            path: mount,
            label,
            name: d.name().to_string_lossy().to_string(),
            fs: d.file_system().to_string_lossy().to_string(),
            total: d.total_space(),
            free: d.available_space(),
            is_removable: d.is_removable(),
            kind: if d.is_removable() {
                "removable"
            } else {
                "fixed"
            }
            .into(),
        });
    }

    for extra in extra_roots() {
        if !out.iter().any(|x| x.path == extra.path) {
            out.push(extra);
        }
    }
    out.sort_by(|a, b| a.path.cmp(&b.path));
    out
}

pub(crate) fn volume_of(path: &str) -> Option<DriveInfo> {
    let target = normalize(path);
    let mut best: Option<DriveInfo> = None;
    for d in drives() {
        if d.total == 0 {
            continue;
        }
        if target.starts_with(&d.path) {
            let better = best
                .as_ref()
                .map(|b| d.path.len() > b.path.len())
                .unwrap_or(true);
            if better {
                best = Some(d);
            }
        }
    }
    best
}
