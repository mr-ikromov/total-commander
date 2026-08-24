use crate::model::{CompareRow, FileEntry, TextChunk};
use md5::Digest as Md5Digest;
use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::{BufReader, BufWriter, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

pub(crate) const VIEW_CHUNK: u64 = 1024 * 1024;

fn sniff_encoding(bytes: &[u8]) -> (&'static encoding_rs::Encoding, usize, &'static str) {
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        (encoding_rs::UTF_8, 3, "UTF-8 BOM")
    } else if bytes.starts_with(&[0xFF, 0xFE]) {
        (encoding_rs::UTF_16LE, 2, "UTF-16 LE")
    } else if bytes.starts_with(&[0xFE, 0xFF]) {
        (encoding_rs::UTF_16BE, 2, "UTF-16 BE")
    } else {
        let (_, _, had_errors) = encoding_rs::UTF_8.decode(&bytes[..bytes.len().min(65536)]);
        if had_errors {
            (encoding_rs::WINDOWS_1252, 0, "Windows-1252")
        } else {
            (encoding_rs::UTF_8, 0, "UTF-8")
        }
    }
}

pub(crate) fn read_text(path: &str, offset: u64, max_bytes: u64) -> Result<TextChunk, String> {
    let mut f = File::open(path).map_err(|e| format!("{path}: {e}"))?;
    let total = f.metadata().map_err(|e| e.to_string())?.len();
    let want = max_bytes
        .min(VIEW_CHUNK.max(max_bytes))
        .min(total.saturating_sub(offset));

    f.seek(SeekFrom::Start(offset)).map_err(|e| e.to_string())?;
    let mut buf = vec![0u8; want as usize];
    let read = f.read(&mut buf).map_err(|e| e.to_string())?;
    buf.truncate(read);

    let is_binary = memchr::memchr(0, &buf[..buf.len().min(8192)]).is_some();
    let (enc, skip, enc_name) = if offset == 0 {
        sniff_encoding(&buf)
    } else {
        (encoding_rs::UTF_8, 0, "UTF-8")
    };
    let (cow, _, _) = enc.decode(&buf[skip.min(buf.len())..]);
    let content = cow.into_owned();

    let line_ending = if content.contains("\r\n") {
        "CRLF"
    } else if content.contains('\r') {
        "CR"
    } else {
        "LF"
    };

    Ok(TextChunk {
        content,
        encoding: enc_name.to_string(),
        total_bytes: total,
        offset,
        read_bytes: read as u64,
        eof: offset + read as u64 >= total,
        is_binary,
        line_ending: line_ending.to_string(),
    })
}

pub(crate) fn read_hex(path: &str, offset: u64, max_bytes: u64) -> Result<TextChunk, String> {
    let mut f = File::open(path).map_err(|e| format!("{path}: {e}"))?;
    let total = f.metadata().map_err(|e| e.to_string())?.len();
    let want = max_bytes.min(total.saturating_sub(offset));
    f.seek(SeekFrom::Start(offset)).map_err(|e| e.to_string())?;
    let mut buf = vec![0u8; want as usize];
    let read = f.read(&mut buf).map_err(|e| e.to_string())?;
    buf.truncate(read);

    let mut out = String::with_capacity(read * 4 + 64);
    for (i, chunk) in buf.chunks(16).enumerate() {
        let addr = offset + (i * 16) as u64;
        out.push_str(&format!("{addr:08X}  "));
        for j in 0..16 {
            if j == 8 {
                out.push(' ');
            }
            match chunk.get(j) {
                Some(b) => out.push_str(&format!("{b:02X} ")),
                None => out.push_str("   "),
            }
        }
        out.push_str(" |");
        for b in chunk {
            out.push(if (0x20..0x7f).contains(b) {
                *b as char
            } else {
                '.'
            });
        }
        out.push_str("|\n");
    }

    Ok(TextChunk {
        content: out,
        encoding: "hex".into(),
        total_bytes: total,
        offset,
        read_bytes: read as u64,
        eof: offset + read as u64 >= total,
        is_binary: true,
        line_ending: "LF".into(),
    })
}

pub(crate) fn write_text(path: &str, content: &str, line_ending: &str) -> Result<(), String> {
    let data = match line_ending {
        "CRLF" => content.replace("\r\n", "\n").replace('\n', "\r\n"),
        "CR" => content.replace("\r\n", "\r").replace('\n', "\r"),
        _ => content.replace("\r\n", "\n"),
    };
    fs::write(path, data).map_err(|e| format!("{path}: {e}"))
}

pub(crate) fn checksum(path: &str, algo: &str) -> Result<String, String> {
    let mut f = BufReader::new(File::open(path).map_err(|e| format!("{path}: {e}"))?);
    let mut buf = vec![0u8; 1024 * 1024];

    macro_rules! stream {
        ($hasher:expr) => {{
            let mut h = $hasher;
            loop {
                let n = f.read(&mut buf).map_err(|e| e.to_string())?;
                if n == 0 {
                    break;
                }
                h.update(&buf[..n]);
            }
            h
        }};
    }

    let out = match algo.to_lowercase().as_str() {
        "md5" => format!("{:x}", stream!(md5::Md5::new()).finalize()),
        "sha256" => format!("{:x}", stream!(sha2::Sha256::new()).finalize()),
        "sha512" => format!("{:x}", stream!(sha2::Sha512::new()).finalize()),
        "crc32" => {
            let mut h = crc32fast::Hasher::new();
            loop {
                let n = f.read(&mut buf).map_err(|e| e.to_string())?;
                if n == 0 {
                    break;
                }
                h.update(&buf[..n]);
            }
            format!("{:08x}", h.finalize())
        }
        other => return Err(format!("Noma'lum algoritm: {other}")),
    };
    Ok(out)
}

pub(crate) fn files_identical(a: &str, b: &str) -> Result<bool, String> {
    let (ma, mb) = (
        fs::metadata(a).map_err(|e| format!("{a}: {e}"))?,
        fs::metadata(b).map_err(|e| format!("{b}: {e}"))?,
    );
    if ma.len() != mb.len() {
        return Ok(false);
    }
    let mut fa = BufReader::new(File::open(a).map_err(|e| e.to_string())?);
    let mut fb = BufReader::new(File::open(b).map_err(|e| e.to_string())?);
    let (mut ba, mut bb) = (vec![0u8; 256 * 1024], vec![0u8; 256 * 1024]);
    loop {
        let na = fa.read(&mut ba).map_err(|e| e.to_string())?;
        let nb = fb.read(&mut bb).map_err(|e| e.to_string())?;
        if na != nb {
            return Ok(false);
        }
        if na == 0 {
            return Ok(true);
        }
        if ba[..na] != bb[..nb] {
            return Ok(false);
        }
    }
}

fn collect_rel(root: &Path, recursive: bool) -> BTreeMap<String, FileEntry> {
    let mut map = BTreeMap::new();
    let walker = walkdir::WalkDir::new(root)
        .max_depth(if recursive { usize::MAX } else { 1 })
        .follow_links(false);
    for e in walker.into_iter().flatten() {
        if e.path() == root {
            continue;
        }
        let Ok(rel) = e.path().strip_prefix(root) else {
            continue;
        };
        if let Ok(entry) = crate::listing::entry_from_path(e.path()) {
            map.insert(rel.to_string_lossy().replace('\\', "/"), entry);
        }
    }
    map
}

pub(crate) fn compare_dirs(
    left: &str,
    right: &str,
    recursive: bool,
    by_content: bool,
) -> Result<Vec<CompareRow>, String> {
    let lroot = PathBuf::from(left);
    let rroot = PathBuf::from(right);
    if !lroot.is_dir() || !rroot.is_dir() {
        return Err("Ikkala tomon ham mavjud papka bo'lishi kerak".into());
    }
    let lmap = collect_rel(&lroot, recursive);
    let rmap = collect_rel(&rroot, recursive);

    let mut keys: Vec<&String> = lmap.keys().chain(rmap.keys()).collect();
    keys.sort();
    keys.dedup();

    let mut rows = Vec::with_capacity(keys.len());
    for k in keys {
        let l = lmap.get(k).cloned();
        let r = rmap.get(k).cloned();
        let status = match (&l, &r) {
            (Some(_), None) => "left-only",
            (None, Some(_)) => "right-only",
            (Some(a), Some(b)) => {
                if a.is_dir && b.is_dir {
                    "same"
                } else if a.is_dir != b.is_dir {
                    "different"
                } else if by_content {
                    match files_identical(&a.path, &b.path) {
                        Ok(true) => "same",
                        Ok(false) => {
                            if a.modified > b.modified {
                                "left-newer"
                            } else {
                                "right-newer"
                            }
                        }
                        Err(_) => "different",
                    }
                } else if a.size == b.size && (a.modified - b.modified).abs() <= 2000 {
                    "same"
                } else if a.modified > b.modified {
                    "left-newer"
                } else if a.modified < b.modified {
                    "right-newer"
                } else {
                    "different"
                }
            }
            (None, None) => continue,
        };
        rows.push(CompareRow {
            left: l,
            right: r,
            status: status.into(),
        });
    }
    Ok(rows)
}

pub(crate) fn split_file(
    path: &str,
    target_dir: &str,
    part_size: u64,
) -> Result<Vec<String>, String> {
    if part_size == 0 {
        return Err("Qism hajmi noldan katta bo'lishi kerak".into());
    }
    let src = Path::new(path);
    let name = src
        .file_name()
        .ok_or("Yaroqsiz fayl")?
        .to_string_lossy()
        .to_string();
    let dir = Path::new(target_dir);
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;

    let mut f = BufReader::new(File::open(src).map_err(|e| format!("{path}: {e}"))?);
    let mut parts = Vec::new();
    let mut buf = vec![0u8; 1024 * 1024];
    let mut index = 1u32;
    let mut crc = crc32fast::Hasher::new();
    let mut total = 0u64;

    loop {
        let part_path = dir.join(format!("{name}.{index:03}"));
        let mut out = BufWriter::new(File::create(&part_path).map_err(|e| e.to_string())?);
        let mut written = 0u64;
        while written < part_size {
            let want = ((part_size - written) as usize).min(buf.len());
            let n = f.read(&mut buf[..want]).map_err(|e| e.to_string())?;
            if n == 0 {
                break;
            }
            out.write_all(&buf[..n]).map_err(|e| e.to_string())?;
            crc.update(&buf[..n]);
            written += n as u64;
            total += n as u64;
        }
        out.flush().map_err(|e| e.to_string())?;
        if written == 0 {
            let _ = fs::remove_file(&part_path);
            break;
        }
        parts.push(part_path.to_string_lossy().to_string());
        if written < part_size {
            break;
        }
        index += 1;
    }

    let manifest = dir.join(format!("{name}.crc"));
    let text = format!(
        "filename={name}\nsize={total}\ncrc32={:08X}\nparts={}\n",
        crc.finalize(),
        parts.len()
    );
    fs::write(&manifest, text).map_err(|e| e.to_string())?;
    parts.push(manifest.to_string_lossy().to_string());
    Ok(parts)
}

pub(crate) fn combine_files(first_part: &str, target: &str) -> Result<u64, String> {
    let first = Path::new(first_part);
    let dir = first.parent().unwrap_or(Path::new("."));
    let stem = first
        .file_stem()
        .ok_or("Yaroqsiz qism nomi")?
        .to_string_lossy()
        .to_string();

    let mut parts: Vec<PathBuf> = fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.file_stem()
                .map(|s| s.to_string_lossy() == stem)
                .unwrap_or(false)
                && p.extension()
                    .map(|e| e.to_string_lossy().chars().all(|c| c.is_ascii_digit()))
                    .unwrap_or(false)
        })
        .collect();
    if parts.is_empty() {
        return Err("Raqamlangan qismlar topilmadi".into());
    }
    parts.sort();

    let mut out = BufWriter::new(File::create(target).map_err(|e| format!("{target}: {e}"))?);
    let mut total = 0u64;
    let mut buf = vec![0u8; 1024 * 1024];
    for p in parts {
        let mut f = BufReader::new(File::open(&p).map_err(|e| e.to_string())?);
        loop {
            let n = f.read(&mut buf).map_err(|e| e.to_string())?;
            if n == 0 {
                break;
            }
            out.write_all(&buf[..n]).map_err(|e| e.to_string())?;
            total += n as u64;
        }
    }
    out.flush().map_err(|e| e.to_string())?;
    Ok(total)
}
