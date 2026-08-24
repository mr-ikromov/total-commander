use crate::model::{ArchiveEntry, ProgressEvent};
use std::fs::{self, File};
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum Kind {
    Zip,
    Tar,
    TarGz,
}

pub(crate) fn kind_of(path: &str) -> Option<Kind> {
    let lower = path.to_lowercase();
    if lower.ends_with(".zip") || lower.ends_with(".jar") || lower.ends_with(".xpi") {
        Some(Kind::Zip)
    } else if lower.ends_with(".tar.gz") || lower.ends_with(".tgz") {
        Some(Kind::TarGz)
    } else if lower.ends_with(".tar") {
        Some(Kind::Tar)
    } else {
        None
    }
}

pub(crate) fn is_archive(path: &str) -> bool {
    kind_of(path).is_some()
}

fn safe_join(base: &Path, rel: &Path) -> Option<PathBuf> {
    let mut out = base.to_path_buf();
    for c in rel.components() {
        match c {
            Component::Normal(part) => out.push(part),
            Component::CurDir => {}
            _ => return None,
        }
    }
    if out.starts_with(base) {
        Some(out)
    } else {
        None
    }
}

pub(crate) fn list(path: &str) -> Result<Vec<ArchiveEntry>, String> {
    let kind = kind_of(path).ok_or_else(|| format!("Qo'llab-quvvatlanmaydigan arxiv: {path}"))?;
    let file = File::open(path).map_err(|e| format!("{path}: {e}"))?;
    let mut out = Vec::new();

    match kind {
        Kind::Zip => {
            let mut zip = zip::ZipArchive::new(BufReader::new(file)).map_err(|e| e.to_string())?;
            for i in 0..zip.len() {
                let f = zip.by_index(i).map_err(|e| e.to_string())?;
                let modified = f
                    .last_modified()
                    .and_then(|d| {
                        chrono::NaiveDate::from_ymd_opt(
                            d.year() as i32,
                            d.month() as u32,
                            d.day() as u32,
                        )
                        .and_then(|nd| {
                            nd.and_hms_opt(d.hour() as u32, d.minute() as u32, d.second() as u32)
                        })
                    })
                    .map(|dt| dt.and_utc().timestamp_millis())
                    .unwrap_or(0);
                out.push(ArchiveEntry {
                    path: f.name().to_string(),
                    size: f.size(),
                    packed_size: f.compressed_size(),
                    is_dir: f.is_dir(),
                    modified,
                    crc: f.crc32(),
                });
            }
        }
        Kind::Tar | Kind::TarGz => {
            let reader: Box<dyn Read> = if kind == Kind::TarGz {
                Box::new(flate2::read::GzDecoder::new(BufReader::new(file)))
            } else {
                Box::new(BufReader::new(file))
            };
            let mut tar = tar::Archive::new(reader);
            for e in tar.entries().map_err(|e| e.to_string())? {
                let e = e.map_err(|e| e.to_string())?;
                let header = e.header();
                let p = e
                    .path()
                    .map_err(|e| e.to_string())?
                    .to_string_lossy()
                    .to_string();
                let is_dir = header.entry_type().is_dir();
                out.push(ArchiveEntry {
                    path: p,
                    size: header.size().unwrap_or(0),
                    packed_size: header.size().unwrap_or(0),
                    is_dir,
                    modified: header.mtime().map(|m| (m as i64) * 1000).unwrap_or(0),
                    crc: 0,
                });
            }
        }
    }
    Ok(out)
}

fn progress(job_id: &str, kind: &str) -> ProgressEvent {
    ProgressEvent {
        job_id: job_id.to_string(),
        kind: kind.to_string(),
        current_file: String::new(),
        target_file: String::new(),
        files_done: 0,
        files_total: 0,
        bytes_done: 0,
        bytes_total: 0,
        file_bytes_done: 0,
        file_bytes_total: 0,
        speed_bps: 0,
        eta_secs: 0,
        done: false,
        cancelled: false,
        errors: Vec::new(),
    }
}

pub(crate) fn extract(
    app: AppHandle,
    job_id: String,
    archive: String,
    target_dir: String,
    only: Vec<String>,
    cancel: Arc<AtomicBool>,
) -> Result<ProgressEvent, String> {
    let kind = kind_of(&archive).ok_or_else(|| format!("Unsupported archive: {archive}"))?;
    let base = PathBuf::from(&target_dir);
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let mut ev = progress(&job_id, "extract");
    let wanted = |name: &str| {
        only.is_empty()
            || only
                .iter()
                .any(|o| name == o || name.starts_with(&format!("{o}/")))
    };

    match kind {
        Kind::Zip => {
            let file = File::open(&archive).map_err(|e| e.to_string())?;
            let mut zip = zip::ZipArchive::new(BufReader::new(file)).map_err(|e| e.to_string())?;
            ev.files_total = zip.len() as u64;
            ev.bytes_total = (0..zip.len())
                .filter_map(|i| zip.by_index(i).ok().map(|f| f.size()))
                .sum();
            let _ = app.emit("fs://progress", &ev);

            for i in 0..zip.len() {
                if cancel.load(Ordering::SeqCst) {
                    ev.cancelled = true;
                    break;
                }
                let mut f = zip.by_index(i).map_err(|e| e.to_string())?;
                let name = f.name().to_string();
                if !wanted(&name) {
                    continue;
                }
                let Some(dst) = safe_join(&base, Path::new(&name)) else {
                    ev.errors.push(format!("Arxivdagi xavfli yo'l: {name}"));
                    continue;
                };
                ev.current_file = name.clone();
                if f.is_dir() {
                    let _ = fs::create_dir_all(&dst);
                } else {
                    if let Some(p) = dst.parent() {
                        let _ = fs::create_dir_all(p);
                    }
                    let mut out = BufWriter::new(File::create(&dst).map_err(|e| e.to_string())?);
                    let mut buf = vec![0u8; 256 * 1024];
                    loop {
                        let n = f.read(&mut buf).map_err(|e| e.to_string())?;
                        if n == 0 {
                            break;
                        }
                        out.write_all(&buf[..n]).map_err(|e| e.to_string())?;
                        ev.bytes_done += n as u64;
                    }
                    out.flush().map_err(|e| e.to_string())?;
                }
                ev.files_done += 1;
                let _ = app.emit("fs://progress", &ev);
            }
        }
        Kind::Tar | Kind::TarGz => {
            let file = File::open(&archive).map_err(|e| e.to_string())?;
            let reader: Box<dyn Read> = if kind == Kind::TarGz {
                Box::new(flate2::read::GzDecoder::new(BufReader::new(file)))
            } else {
                Box::new(BufReader::new(file))
            };
            let mut tar = tar::Archive::new(reader);
            for e in tar.entries().map_err(|e| e.to_string())? {
                if cancel.load(Ordering::SeqCst) {
                    ev.cancelled = true;
                    break;
                }
                let mut e = e.map_err(|er| er.to_string())?;
                let rel = e.path().map_err(|er| er.to_string())?.to_path_buf();
                let name = rel.to_string_lossy().to_string();
                if !wanted(&name) {
                    continue;
                }
                let Some(dst) = safe_join(&base, &rel) else {
                    ev.errors.push(format!("Arxivdagi xavfli yo'l: {name}"));
                    continue;
                };
                ev.current_file = name;
                if let Some(p) = dst.parent() {
                    let _ = fs::create_dir_all(p);
                }
                if let Err(err) = e.unpack(&dst) {
                    ev.errors.push(err.to_string());
                }
                ev.files_done += 1;
                ev.bytes_done += e.header().size().unwrap_or(0);
                let _ = app.emit("fs://progress", &ev);
            }
        }
    }

    ev.done = true;
    let _ = app.emit("fs://progress", &ev);
    Ok(ev)
}

pub(crate) fn create(
    app: AppHandle,
    job_id: String,
    archive: String,
    sources: Vec<String>,
    base_dir: String,
    level: i64,
    cancel: Arc<AtomicBool>,
) -> Result<ProgressEvent, String> {
    let kind =
        kind_of(&archive).ok_or_else(|| "Qo'llab-quvvatlanmaydigan arxiv formati".to_string())?;
    let base = PathBuf::from(&base_dir);
    let mut ev = progress(&job_id, "pack");

    let mut items: Vec<(PathBuf, String)> = Vec::new();
    for s in &sources {
        let p = PathBuf::from(s);
        let rel_root = p.strip_prefix(&base).unwrap_or(Path::new("")).to_path_buf();
        let rel_root = if rel_root.as_os_str().is_empty() {
            PathBuf::from(p.file_name().unwrap_or_default())
        } else {
            rel_root
        };
        if p.is_dir() {
            for e in walkdir::WalkDir::new(&p).into_iter().flatten() {
                let rel = e.path().strip_prefix(&p).unwrap_or(Path::new(""));
                let arc_rel = rel_root.join(rel);
                items.push((
                    e.path().to_path_buf(),
                    arc_rel.to_string_lossy().replace('\\', "/"),
                ));
            }
        } else {
            items.push((p, rel_root.to_string_lossy().replace('\\', "/")));
        }
    }
    ev.files_total = items.len() as u64;
    ev.bytes_total = items
        .iter()
        .filter_map(|(p, _)| fs::metadata(p).ok())
        .filter(|m| m.is_file())
        .map(|m| m.len())
        .sum();
    let _ = app.emit("fs://progress", &ev);

    let out = File::create(&archive).map_err(|e| format!("{archive}: {e}"))?;

    match kind {
        Kind::Zip => {
            let mut zip = zip::ZipWriter::new(BufWriter::new(out));
            let opts: zip::write::SimpleFileOptions = zip::write::SimpleFileOptions::default()
                .compression_method(if level == 0 {
                    zip::CompressionMethod::Stored
                } else {
                    zip::CompressionMethod::Deflated
                })
                .compression_level(if level == 0 {
                    None
                } else {
                    Some(level.clamp(1, 9))
                })
                .large_file(true);

            for (abs, rel) in &items {
                if cancel.load(Ordering::SeqCst) {
                    ev.cancelled = true;
                    break;
                }
                ev.current_file = abs.to_string_lossy().to_string();
                if abs.is_dir() {
                    if !rel.is_empty() {
                        zip.add_directory(format!("{rel}/"), opts)
                            .map_err(|e| e.to_string())?;
                    }
                } else {
                    zip.start_file(rel.clone(), opts)
                        .map_err(|e| e.to_string())?;
                    let mut f = BufReader::new(File::open(abs).map_err(|e| e.to_string())?);
                    let mut buf = vec![0u8; 256 * 1024];
                    loop {
                        let n = f.read(&mut buf).map_err(|e| e.to_string())?;
                        if n == 0 {
                            break;
                        }
                        zip.write_all(&buf[..n]).map_err(|e| e.to_string())?;
                        ev.bytes_done += n as u64;
                    }
                }
                ev.files_done += 1;
                let _ = app.emit("fs://progress", &ev);
            }
            zip.finish().map_err(|e| e.to_string())?;
        }
        Kind::Tar | Kind::TarGz => {
            let writer: Box<dyn Write> = if kind == Kind::TarGz {
                Box::new(flate2::write::GzEncoder::new(
                    BufWriter::new(out),
                    flate2::Compression::new(level.clamp(0, 9) as u32),
                ))
            } else {
                Box::new(BufWriter::new(out))
            };
            let mut builder = tar::Builder::new(writer);
            for (abs, rel) in &items {
                if cancel.load(Ordering::SeqCst) {
                    ev.cancelled = true;
                    break;
                }
                ev.current_file = abs.to_string_lossy().to_string();
                let res = if abs.is_dir() {
                    builder.append_dir(rel, abs)
                } else {
                    builder.append_path_with_name(abs, rel)
                };
                if let Err(e) = res {
                    ev.errors.push(format!("{}: {}", abs.display(), e));
                }
                ev.files_done += 1;
                ev.bytes_done += fs::metadata(abs).map(|m| m.len()).unwrap_or(0);
                let _ = app.emit("fs://progress", &ev);
            }
            builder.finish().map_err(|e| e.to_string())?;
            let inner = builder.into_inner().map_err(|e| e.to_string())?;
            drop(inner);
        }
    }

    if ev.cancelled {
        let _ = fs::remove_file(&archive);
    }
    ev.done = true;
    let _ = app.emit("fs://progress", &ev);
    Ok(ev)
}
