use crate::model::{OpRequest, ProgressEvent};
use parking_lot::Mutex;
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

const BUF_SIZE: usize = 1024 * 1024;

const EMIT_INTERVAL: Duration = Duration::from_millis(60);

#[derive(Default)]
pub(crate) struct JobRegistry {
    flags: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl JobRegistry {
    pub(crate) fn register(&self, id: &str) -> Arc<AtomicBool> {
        let flag = Arc::new(AtomicBool::new(false));
        self.flags.lock().insert(id.to_string(), flag.clone());
        flag
    }
    pub(crate) fn cancel(&self, id: &str) -> bool {
        match self.flags.lock().get(id) {
            Some(f) => {
                f.store(true, Ordering::SeqCst);
                true
            }
            None => false,
        }
    }
    pub(crate) fn finish(&self, id: &str) {
        self.flags.lock().remove(id);
    }
}

struct Emitters {
    app: AppHandle,
    last: Instant,
    started: Instant,
}

impl Emitters {
    fn new(app: AppHandle) -> Self {
        Self {
            app,
            last: Instant::now() - EMIT_INTERVAL,
            started: Instant::now(),
        }
    }
    fn send(&mut self, mut ev: ProgressEvent, force: bool) {
        if !force && self.last.elapsed() < EMIT_INTERVAL {
            return;
        }
        self.last = Instant::now();
        let secs = self.started.elapsed().as_secs_f64().max(0.001);
        ev.speed_bps = (ev.bytes_done as f64 / secs) as u64;
        ev.eta_secs = if ev.speed_bps > 0 && ev.bytes_total > ev.bytes_done {
            (ev.bytes_total - ev.bytes_done) / ev.speed_bps
        } else {
            0
        };
        let _ = self.app.emit("fs://progress", &ev);
    }
}

fn new_event(job_id: &str, kind: &str) -> ProgressEvent {
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

struct Task {
    src: PathBuf,
    dst: PathBuf,
    is_dir: bool,
    size: u64,
}

fn plan(
    sources: &[String],
    target_dir: &Path,
    rename_to: Option<&str>,
) -> (Vec<Task>, u64, Vec<String>) {
    let mut tasks = Vec::new();
    let mut total = 0u64;
    let mut errors = Vec::new();
    let single = sources.len() == 1;

    for s in sources {
        let src = PathBuf::from(s);
        let base_name = match (single, rename_to) {
            (true, Some(r)) if !r.is_empty() => r.to_string(),
            _ => src
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default(),
        };
        if base_name.is_empty() {
            errors.push(format!("Yaroqsiz manba: {}", src.display()));
            continue;
        }
        let dst_root = target_dir.join(&base_name);

        let md = match fs::symlink_metadata(&src) {
            Ok(m) => m,
            Err(e) => {
                errors.push(format!("{}: {}", src.display(), e));
                continue;
            }
        };

        if md.is_dir() {
            tasks.push(Task {
                src: src.clone(),
                dst: dst_root.clone(),
                is_dir: true,
                size: 0,
            });
            for e in walkdir::WalkDir::new(&src).follow_links(false).into_iter() {
                let e = match e {
                    Ok(e) => e,
                    Err(err) => {
                        errors.push(err.to_string());
                        continue;
                    }
                };
                if e.path() == src {
                    continue;
                }
                let rel = match e.path().strip_prefix(&src) {
                    Ok(r) => r,
                    Err(_) => continue,
                };
                let dst = dst_root.join(rel);
                let is_dir = e.file_type().is_dir();
                let size = if is_dir {
                    0
                } else {
                    e.metadata().map(|m| m.len()).unwrap_or(0)
                };
                total += size;
                tasks.push(Task {
                    src: e.path().to_path_buf(),
                    dst,
                    is_dir,
                    size,
                });
            }
        } else {
            total += md.len();
            tasks.push(Task {
                src,
                dst: dst_root,
                is_dir: false,
                size: md.len(),
            });
        }
    }
    (tasks, total, errors)
}

fn resolve_conflict(dst: &Path, src: &Path, mode: &str) -> Result<Option<PathBuf>, String> {
    if !dst.exists() {
        return Ok(Some(dst.to_path_buf()));
    }
    match mode {
        "skip" => Ok(None),
        "overwrite" => Ok(Some(dst.to_path_buf())),
        "newer" => {
            let s = fs::metadata(src).and_then(|m| m.modified()).ok();
            let d = fs::metadata(dst).and_then(|m| m.modified()).ok();
            match (s, d) {
                (Some(s), Some(d)) if s > d => Ok(Some(dst.to_path_buf())),
                _ => Ok(None),
            }
        }
        _ => {
            let stem = dst
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            let ext = dst.extension().map(|s| s.to_string_lossy().to_string());
            let parent = dst.parent().unwrap_or(Path::new("."));
            for n in 1..10_000u32 {
                let candidate = match &ext {
                    Some(e) => parent.join(format!("{stem} ({n}).{e}")),
                    None => parent.join(format!("{stem} ({n})")),
                };
                if !candidate.exists() {
                    return Ok(Some(candidate));
                }
            }
            Err(format!("{} uchun bo'sh nom topilmadi", dst.display()))
        }
    }
}

const CANCELLED: &str = "cancelled";

fn copy_file_streaming(
    src: &Path,
    dst: &Path,
    cancel: &AtomicBool,
    preserve_times: bool,
    on_chunk: &mut dyn FnMut(u64, u64),
) -> Result<(), String> {
    let mut reader = File::open(src).map_err(|e| format!("{}: {}", src.display(), e))?;
    let size = reader.metadata().map(|m| m.len()).unwrap_or(0);
    let mut writer = File::create(dst).map_err(|e| format!("{}: {}", dst.display(), e))?;

    let mut done = 0u64;
    let mut buf = vec![0u8; BUF_SIZE];
    loop {
        if cancel.load(Ordering::SeqCst) {
            drop(writer);
            let _ = fs::remove_file(dst);
            return Err(CANCELLED.into());
        }
        let n = reader
            .read(&mut buf)
            .map_err(|e| format!("{}: {}", src.display(), e))?;
        if n == 0 {
            break;
        }
        writer
            .write_all(&buf[..n])
            .map_err(|e| format!("{}: {}", dst.display(), e))?;
        done += n as u64;
        on_chunk(n as u64, size.max(done));
    }
    writer.flush().map_err(|e| e.to_string())?;

    if let Ok(md) = fs::metadata(src) {
        let _ = fs::set_permissions(dst, md.permissions());
        if preserve_times {
            if let Ok(mtime) = md.modified() {
                let _ = File::options()
                    .write(true)
                    .open(dst)
                    .and_then(|f| f.set_modified(mtime));
            }
        }
    }
    Ok(())
}

pub(crate) fn run_transfer(
    app: AppHandle,
    req: OpRequest,
    is_move: bool,
    cancel: Arc<AtomicBool>,
) -> ProgressEvent {
    let target = PathBuf::from(&req.target_dir);
    let mut em = Emitters::new(app);
    let mut ev = new_event(&req.job_id, if is_move { "move" } else { "copy" });

    if let Err(e) = fs::create_dir_all(&target) {
        ev.errors.push(format!("{}: {}", target.display(), e));
        ev.done = true;
        em.send(ev.clone(), true);
        return ev;
    }

    if is_move {
        let mut all_renamed = true;
        for s in &req.sources {
            let src = PathBuf::from(s);
            let name = match (req.sources.len() == 1, req.rename_to.as_deref()) {
                (true, Some(r)) if !r.is_empty() => r.to_string(),
                _ => src
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default(),
            };
            let dst = target.join(&name);
            if dst.exists() && req.conflict == "skip" {
                continue;
            }
            let dst = match resolve_conflict(&dst, &src, &req.conflict) {
                Ok(Some(p)) => p,
                Ok(None) => continue,
                Err(_) => {
                    all_renamed = false;
                    break;
                }
            };
            if fs::rename(&src, &dst).is_ok() {
                ev.files_done += 1;
                ev.current_file = s.clone();
                em.send(ev.clone(), false);
            } else {
                all_renamed = false;
                break;
            }
        }
        if all_renamed {
            ev.files_total = ev.files_done;
            ev.done = true;
            em.send(ev.clone(), true);
            return ev;
        }
    }

    let remaining: Vec<String> = req
        .sources
        .iter()
        .filter(|s| Path::new(s).exists())
        .cloned()
        .collect();

    let (tasks, total_bytes, plan_errors) = plan(&remaining, &target, req.rename_to.as_deref());
    ev.errors.extend(plan_errors);
    ev.files_total = tasks.iter().filter(|t| !t.is_dir).count() as u64;
    ev.bytes_total = total_bytes;
    em.send(ev.clone(), true);

    let mut created_dirs: Vec<PathBuf> = Vec::new();

    for task in &tasks {
        if cancel.load(Ordering::SeqCst) {
            ev.cancelled = true;
            break;
        }
        if task.is_dir {
            if let Err(e) = fs::create_dir_all(&task.dst) {
                ev.errors.push(format!("{}: {}", task.dst.display(), e));
            } else {
                created_dirs.push(task.src.clone());
            }
            continue;
        }

        if task.dst == task.src {
            ev.errors.push(format!(
                "Source and target are identical: {}",
                task.src.display()
            ));
            continue;
        }
        if let Some(p) = task.dst.parent() {
            let _ = fs::create_dir_all(p);
        }
        let dst = match resolve_conflict(&task.dst, &task.src, &req.conflict) {
            Ok(Some(p)) => p,
            Ok(None) => {
                ev.files_done += 1;
                ev.bytes_done += task.size;
                em.send(ev.clone(), false);
                continue;
            }
            Err(e) => {
                ev.errors.push(e);
                continue;
            }
        };

        ev.current_file = task.src.to_string_lossy().to_string();
        ev.target_file = dst.to_string_lossy().to_string();
        em.send(ev.clone(), false);

        ev.file_bytes_total = task.size;
        ev.file_bytes_done = 0;
        let mut snapshot = ev.clone();
        let result = copy_file_streaming(
            &task.src,
            &dst,
            &cancel,
            req.preserve_times,
            &mut |chunk, total| {
                snapshot.bytes_done += chunk;
                snapshot.file_bytes_done += chunk;
                snapshot.file_bytes_total = total;
                em.send(snapshot.clone(), false);
            },
        );
        ev.bytes_done = snapshot.bytes_done;
        ev.file_bytes_done = snapshot.file_bytes_done;

        match result {
            Ok(()) => {
                ev.files_done += 1;
                if is_move {
                    if let Err(e) = fs::remove_file(&task.src) {
                        ev.errors.push(format!("{}: {}", task.src.display(), e));
                    }
                }
            }
            Err(e) if e == CANCELLED => {
                ev.cancelled = true;
                break;
            }
            Err(e) => ev.errors.push(e),
        }
    }

    if is_move && !ev.cancelled {
        created_dirs.sort_by_key(|p| std::cmp::Reverse(p.components().count()));
        for d in created_dirs {
            let _ = fs::remove_dir(&d);
        }
        for s in &remaining {
            let p = Path::new(s);
            if p.is_dir() {
                let _ = fs::remove_dir(p);
            }
        }
    }

    ev.done = true;
    em.send(ev.clone(), true);
    ev
}

pub(crate) fn run_delete(
    app: AppHandle,
    job_id: String,
    paths: Vec<String>,
    to_trash: bool,
    cancel: Arc<AtomicBool>,
) -> ProgressEvent {
    let mut em = Emitters::new(app);
    let mut ev = new_event(&job_id, "delete");

    if to_trash {
        ev.files_total = paths.len() as u64;
        for p in &paths {
            if cancel.load(Ordering::SeqCst) {
                ev.cancelled = true;
                break;
            }
            ev.current_file = p.clone();
            match trash::delete(p) {
                Ok(()) => ev.files_done += 1,
                Err(e) => ev.errors.push(format!("{p}: {e}")),
            }
            em.send(ev.clone(), false);
        }
        ev.done = true;
        em.send(ev.clone(), true);
        return ev;
    }

    let mut victims: Vec<(PathBuf, bool)> = Vec::new();
    for p in &paths {
        let path = PathBuf::from(p);
        let md = match fs::symlink_metadata(&path) {
            Ok(m) => m,
            Err(e) => {
                ev.errors.push(format!("{p}: {e}"));
                continue;
            }
        };
        if md.is_dir() && !md.file_type().is_symlink() {
            for e in walkdir::WalkDir::new(&path)
                .contents_first(true)
                .into_iter()
                .flatten()
            {
                victims.push((e.path().to_path_buf(), e.file_type().is_dir()));
            }
        } else {
            victims.push((path, false));
        }
    }
    ev.files_total = victims.len() as u64;
    em.send(ev.clone(), true);

    for (path, is_dir) in victims {
        if cancel.load(Ordering::SeqCst) {
            ev.cancelled = true;
            break;
        }
        ev.current_file = path.to_string_lossy().to_string();
        let res = if is_dir {
            fs::remove_dir(&path)
        } else {
            if let Ok(md) = fs::metadata(&path) {
                let mut perms = md.permissions();
                if perms.readonly() {
                    #[allow(clippy::permissions_set_readonly_false)]
                    perms.set_readonly(false);
                    let _ = fs::set_permissions(&path, perms);
                }
            }
            fs::remove_file(&path)
        };
        match res {
            Ok(()) => ev.files_done += 1,
            Err(e) => ev.errors.push(format!("{}: {}", path.display(), e)),
        }
        em.send(ev.clone(), false);
    }

    ev.done = true;
    em.send(ev.clone(), true);
    ev
}
