use crate::model::{SearchHit, SearchQuery};
use regex::RegexBuilder;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

const CONTENT_CHUNK: usize = 4 * 1024 * 1024;

pub(crate) fn matches_mask(name: &str, mask: &str, case_sensitive: bool) -> bool {
    let mask = mask.trim();
    if mask.is_empty() || mask == "*" || mask == "*.*" {
        return true;
    }
    let hay = if case_sensitive {
        name.to_string()
    } else {
        name.to_lowercase()
    };
    mask.split([';', ','])
        .map(str::trim)
        .filter(|m| !m.is_empty())
        .any(|m| {
            let m = if case_sensitive {
                m.to_string()
            } else {
                m.to_lowercase()
            };
            wildcard(&hay, &m)
        })
}

fn wildcard(text: &str, pat: &str) -> bool {
    let t: Vec<char> = text.chars().collect();
    let p: Vec<char> = pat.chars().collect();
    let (mut ti, mut pi) = (0usize, 0usize);
    let (mut star, mut mark) = (usize::MAX, 0usize);

    while ti < t.len() {
        if pi < p.len() && (p[pi] == '?' || p[pi] == t[ti]) {
            ti += 1;
            pi += 1;
        } else if pi < p.len() && p[pi] == '*' {
            star = pi;
            mark = ti;
            pi += 1;
        } else if star != usize::MAX {
            pi = star + 1;
            mark += 1;
            ti = mark;
        } else {
            return false;
        }
    }
    while pi < p.len() && p[pi] == '*' {
        pi += 1;
    }
    pi == p.len()
}

fn decode(bytes: &[u8]) -> String {
    let (cow, _, _) = encoding_rs::UTF_8.decode(bytes);
    if cow.contains('\u{FFFD}') {
        let (cow2, _, _) = encoding_rs::WINDOWS_1252.decode(bytes);
        return cow2.into_owned();
    }
    cow.into_owned()
}

fn looks_binary(bytes: &[u8]) -> bool {
    memchr::memchr(0, &bytes[..bytes.len().min(8192)]).is_some()
}

struct Matcher {
    regex: Option<regex::Regex>,
    plain: Option<String>,
    case_sensitive: bool,
}

impl Matcher {
    fn build(q: &SearchQuery) -> Result<Option<Self>, String> {
        if q.content.is_empty() {
            return Ok(None);
        }
        if q.use_regex {
            let re = RegexBuilder::new(&q.content)
                .case_insensitive(!q.case_sensitive)
                .build()
                .map_err(|e| e.to_string())?;
            Ok(Some(Self {
                regex: Some(re),
                plain: None,
                case_sensitive: q.case_sensitive,
            }))
        } else if q.whole_words {
            let re = RegexBuilder::new(&format!(r"\b{}\b", regex::escape(&q.content)))
                .case_insensitive(!q.case_sensitive)
                .build()
                .map_err(|e| e.to_string())?;
            Ok(Some(Self {
                regex: Some(re),
                plain: None,
                case_sensitive: q.case_sensitive,
            }))
        } else {
            let needle = if q.case_sensitive {
                q.content.clone()
            } else {
                q.content.to_lowercase()
            };
            Ok(Some(Self {
                regex: None,
                plain: Some(needle),
                case_sensitive: q.case_sensitive,
            }))
        }
    }

    fn first_hit(&self, path: &Path) -> Option<(usize, String)> {
        let mut f = File::open(path).ok()?;
        let mut buf = Vec::with_capacity(CONTENT_CHUNK.min(1 << 20));
        let mut probe = [0u8; 8192];
        let n = f.read(&mut probe).ok()?;
        if looks_binary(&probe[..n]) {
            return None;
        }
        buf.extend_from_slice(&probe[..n]);
        f.take((CONTENT_CHUNK - n) as u64)
            .read_to_end(&mut buf)
            .ok()?;

        let text = decode(&buf);
        for (i, line) in text.lines().enumerate() {
            let hit = match (&self.regex, &self.plain) {
                (Some(re), _) => re.is_match(line),
                (None, Some(needle)) => {
                    if self.case_sensitive {
                        line.contains(needle.as_str())
                    } else {
                        line.to_lowercase().contains(needle.as_str())
                    }
                }
                _ => false,
            };
            if hit {
                let trimmed: String = line.chars().take(400).collect();
                return Some((i + 1, trimmed.trim().to_string()));
            }
        }
        None
    }
}

pub(crate) fn run_search(
    app: AppHandle,
    q: SearchQuery,
    cancel: Arc<AtomicBool>,
) -> Result<Vec<SearchHit>, String> {
    let matcher = Matcher::build(&q)?;
    let mut hits: Vec<SearchHit> = Vec::new();
    let mut batch: Vec<SearchHit> = Vec::new();
    let mut last = Instant::now();
    let max = if q.max_results == 0 {
        usize::MAX
    } else {
        q.max_results
    };
    let depth = if q.max_depth == 0 {
        usize::MAX
    } else {
        q.max_depth
    };
    let mut scanned: u64 = 0;

    'roots: for root in &q.roots {
        let walker = walkdir::WalkDir::new(root)
            .follow_links(false)
            .max_depth(depth)
            .into_iter()
            .filter_entry(|e| {
                q.include_hidden
                    || e.depth() == 0
                    || !e.file_name().to_string_lossy().starts_with('.')
            });

        for entry in walker {
            if cancel.load(Ordering::SeqCst) {
                break 'roots;
            }
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };
            scanned += 1;
            let name = entry.file_name().to_string_lossy().to_string();
            let is_dir = entry.file_type().is_dir();

            if !matches_mask(&name, &q.name_mask, q.case_sensitive) {
                if last.elapsed() > Duration::from_millis(120) {
                    last = Instant::now();
                    let _ = app.emit("search://progress", (&q.job_id, scanned, hits.len()));
                }
                continue;
            }

            let md = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            let size = if is_dir { 0 } else { md.len() };
            if let Some(min) = q.min_size {
                if size < min {
                    continue;
                }
            }
            if let Some(maxs) = q.max_size {
                if size > maxs {
                    continue;
                }
            }
            let modified = crate::listing::to_millis(md.modified());
            if let Some(newer) = q.newer_than {
                if modified < newer {
                    continue;
                }
            }
            if let Some(older) = q.older_than {
                if modified > older {
                    continue;
                }
            }

            let (line_no, line_text) = match (&matcher, is_dir) {
                (Some(m), false) => match m.first_hit(entry.path()) {
                    Some((n, t)) => (Some(n), Some(t)),
                    None => continue,
                },
                (Some(_), true) => continue,
                (None, _) => (None, None),
            };

            let hit = SearchHit {
                path: entry.path().to_string_lossy().to_string(),
                file_name: name,
                size,
                modified,
                is_dir,
                line_no,
                line_text,
            };
            batch.push(hit.clone());
            hits.push(hit);

            if last.elapsed() > Duration::from_millis(120) || batch.len() >= 200 {
                last = Instant::now();
                let _ = app.emit("search://hits", (&q.job_id, &batch));
                batch.clear();
            }
            if hits.len() >= max {
                break 'roots;
            }
        }
    }

    if !batch.is_empty() {
        let _ = app.emit("search://hits", (&q.job_id, &batch));
    }
    let _ = app.emit(
        "search://done",
        (&q.job_id, hits.len(), cancel.load(Ordering::SeqCst)),
    );
    Ok(hits)
}
