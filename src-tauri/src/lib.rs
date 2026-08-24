mod archive;
mod fsops;
mod listing;
mod model;
mod search;
mod tools;

use fsops::JobRegistry;
use model::*;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

pub(crate) struct AppState {
    jobs: JobRegistry,
}

#[tauri::command]
fn list_dir(path: String, show_hidden: bool) -> Result<Listing, String> {
    listing::list_dir(&path, show_hidden)
}

#[tauri::command]
fn stat_path(path: String) -> Result<FileEntry, String> {
    listing::entry_from_path(Path::new(&path)).map_err(|e| format!("{path}: {e}"))
}

#[tauri::command]
fn get_drives() -> Vec<DriveInfo> {
    listing::drives()
}

#[tauri::command]
fn volume_info(path: String) -> Option<DriveInfo> {
    listing::volume_of(&path)
}

#[tauri::command]
fn dir_stats(path: String) -> DirStats {
    listing::dir_stats(&path)
}

#[tauri::command]
fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

fn dirs_home() -> PathBuf {
    #[cfg(windows)]
    {
        std::env::var_os("USERPROFILE")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("C:\\"))
    }
    #[cfg(not(windows))]
    {
        std::env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("/"))
    }
}

#[tauri::command]
fn join_path(base: String, child: String) -> String {
    Path::new(&base).join(child).to_string_lossy().to_string()
}

#[tauri::command]
fn create_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| format!("{path}: {e}"))
}

#[tauri::command]
fn create_file(path: String) -> Result<(), String> {
    if Path::new(&path).exists() {
        return Err(format!("Allaqachon mavjud: {path}"));
    }
    if let Some(p) = Path::new(&path).parent() {
        fs::create_dir_all(p).map_err(|e| e.to_string())?;
    }
    fs::write(&path, b"").map_err(|e| format!("{path}: {e}"))
}

#[tauri::command]
fn rename_path(from: String, to: String) -> Result<String, String> {
    let src = PathBuf::from(&from);
    let dst = if Path::new(&to).is_absolute() {
        PathBuf::from(&to)
    } else {
        src.parent().unwrap_or(Path::new(".")).join(&to)
    };
    if dst.exists() && dst != src {
        return Err(format!("Nishon allaqachon mavjud: {}", dst.display()));
    }
    fs::rename(&src, &dst).map_err(|e| format!("{from} -> {to}: {e}"))?;
    Ok(dst.to_string_lossy().to_string())
}

#[tauri::command]
async fn copy_items(
    app: AppHandle,
    state: State<'_, AppState>,
    req: OpRequest,
) -> Result<ProgressEvent, String> {
    let flag = state.jobs.register(&req.job_id);
    let id = req.job_id.clone();
    let res = run_blocking(move || fsops::run_transfer(app, req, false, flag)).await;
    state.jobs.finish(&id);
    res
}

#[tauri::command]
async fn move_items(
    app: AppHandle,
    state: State<'_, AppState>,
    req: OpRequest,
) -> Result<ProgressEvent, String> {
    let flag = state.jobs.register(&req.job_id);
    let id = req.job_id.clone();
    let res = run_blocking(move || fsops::run_transfer(app, req, true, flag)).await;
    state.jobs.finish(&id);
    res
}

#[tauri::command]
async fn delete_items(
    app: AppHandle,
    state: State<'_, AppState>,
    job_id: String,
    paths: Vec<String>,
    to_trash: bool,
) -> Result<ProgressEvent, String> {
    let flag = state.jobs.register(&job_id);
    let id = job_id.clone();
    let res = run_blocking(move || fsops::run_delete(app, job_id, paths, to_trash, flag)).await;
    state.jobs.finish(&id);
    res
}

#[tauri::command]
fn cancel_job(state: State<'_, AppState>, job_id: String) -> bool {
    state.jobs.cancel(&job_id)
}

async fn run_blocking<T, F>(f: F) -> Result<T, String>
where
    F: FnOnce() -> T + Send + 'static,
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn find_files(
    app: AppHandle,
    state: State<'_, AppState>,
    query: SearchQuery,
) -> Result<Vec<SearchHit>, String> {
    let flag: Arc<AtomicBool> = state.jobs.register(&query.job_id);
    let id = query.job_id.clone();
    let res = run_blocking(move || search::run_search(app, query, flag)).await?;
    state.jobs.finish(&id);
    res
}

#[tauri::command]
fn archive_is_supported(path: String) -> bool {
    archive::is_archive(&path)
}

#[tauri::command]
async fn archive_list(path: String) -> Result<Vec<ArchiveEntry>, String> {
    run_blocking(move || archive::list(&path)).await?
}

#[tauri::command]
async fn archive_extract(
    app: AppHandle,
    state: State<'_, AppState>,
    job_id: String,
    archive_path: String,
    target_dir: String,
    only: Vec<String>,
) -> Result<ProgressEvent, String> {
    let flag = state.jobs.register(&job_id);
    let id = job_id.clone();
    let res =
        run_blocking(move || archive::extract(app, job_id, archive_path, target_dir, only, flag))
            .await?;
    state.jobs.finish(&id);
    res
}

#[tauri::command]
async fn archive_create(
    app: AppHandle,
    state: State<'_, AppState>,
    job_id: String,
    archive_path: String,
    sources: Vec<String>,
    base_dir: String,
    level: i64,
) -> Result<ProgressEvent, String> {
    let flag = state.jobs.register(&job_id);
    let id = job_id.clone();
    let res = run_blocking(move || {
        archive::create(app, job_id, archive_path, sources, base_dir, level, flag)
    })
    .await?;
    state.jobs.finish(&id);
    res
}

#[tauri::command]
async fn read_text_chunk(path: String, offset: u64, max_bytes: u64) -> Result<TextChunk, String> {
    run_blocking(move || tools::read_text(&path, offset, max_bytes)).await?
}

#[tauri::command]
async fn read_hex_chunk(path: String, offset: u64, max_bytes: u64) -> Result<TextChunk, String> {
    run_blocking(move || tools::read_hex(&path, offset, max_bytes)).await?
}

#[tauri::command]
async fn write_text_file(path: String, content: String, line_ending: String) -> Result<(), String> {
    run_blocking(move || tools::write_text(&path, &content, &line_ending)).await?
}

#[tauri::command]
async fn file_checksum(path: String, algo: String) -> Result<String, String> {
    run_blocking(move || tools::checksum(&path, &algo)).await?
}

#[tauri::command]
async fn compare_files(left: String, right: String) -> Result<bool, String> {
    run_blocking(move || tools::files_identical(&left, &right)).await?
}

#[tauri::command]
async fn compare_dirs(
    left: String,
    right: String,
    recursive: bool,
    by_content: bool,
) -> Result<Vec<CompareRow>, String> {
    run_blocking(move || tools::compare_dirs(&left, &right, recursive, by_content)).await?
}

#[tauri::command]
async fn split_file(
    path: String,
    target_dir: String,
    part_size: u64,
) -> Result<Vec<String>, String> {
    run_blocking(move || tools::split_file(&path, &target_dir, part_size)).await?
}

#[tauri::command]
async fn combine_files(first_part: String, target: String) -> Result<u64, String> {
    run_blocking(move || tools::combine_files(&first_part, &target)).await?
}

#[tauri::command]
fn apply_renames(plan: Vec<(String, String)>) -> Result<Vec<String>, String> {
    let mut seen = std::collections::HashSet::new();
    for (_, to) in &plan {
        if !seen.insert(to.clone()) {
            return Err(format!("Takrorlanuvchi nom: {to}"));
        }
    }
    let mut done = Vec::new();
    let mut errors = Vec::new();

    let mut temps = Vec::new();
    for (from, to) in &plan {
        if from == to {
            continue;
        }
        let tmp = format!("{from}.tcrename-{}", uuid::Uuid::new_v4().simple());
        match fs::rename(from, &tmp) {
            Ok(()) => temps.push((tmp, to.clone())),
            Err(e) => errors.push(format!("{from}: {e}")),
        }
    }
    for (tmp, to) in temps {
        match fs::rename(&tmp, &to) {
            Ok(()) => done.push(to),
            Err(e) => {
                errors.push(format!("{to}: {e}"));
                let _ = fs::rename(&tmp, to.clone());
            }
        }
    }
    if !errors.is_empty() {
        return Err(errors.join("\n"));
    }
    Ok(done)
}

#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    open::that_detached(&path).map_err(|e| format!("{path}: {e}"))
}

#[tauri::command]
fn reveal_in_manager(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    let dir = if p.is_dir() {
        p
    } else {
        p.parent().unwrap_or(Path::new("."))
    };
    open::that_detached(dir).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_terminal(cwd: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let candidates: Vec<(&str, Vec<String>)> = vec![
        ("wt.exe", vec!["-d".into(), cwd.clone()]),
        ("cmd.exe", vec!["/K".into(), format!("cd /d {cwd}")]),
    ];
    #[cfg(target_os = "macos")]
    let candidates: Vec<(&str, Vec<String>)> =
        vec![("open", vec!["-a".into(), "Terminal".into(), cwd.clone()])];
    #[cfg(all(unix, not(target_os = "macos")))]
    let candidates: Vec<(&str, Vec<String>)> = vec![
        ("x-terminal-emulator", vec![]),
        ("gnome-terminal", vec![]),
        ("konsole", vec![]),
        ("xfce4-terminal", vec![]),
        ("alacritty", vec![]),
        ("kitty", vec![]),
        ("xterm", vec![]),
    ];

    for (prog, args) in candidates {
        if std::process::Command::new(prog)
            .args(&args)
            .current_dir(&cwd)
            .spawn()
            .is_ok()
        {
            return Ok(());
        }
    }
    Err("Terminal dasturi topilmadi".into())
}

#[tauri::command]
fn system_info() -> serde_json::Value {
    serde_json::json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "family": std::env::consts::FAMILY,
        "sep": std::path::MAIN_SEPARATOR.to_string(),
        "home": dirs_home().to_string_lossy(),
        "version": env!("CARGO_PKG_VERSION"),
    })
}

#[tauri::command]
fn clipboard_write_text(app: AppHandle, text: String) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    app.clipboard().write_text(text).map_err(|e| e.to_string())
}

fn config_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("settings.json"))
}

#[tauri::command]
fn load_settings(app: AppHandle) -> serde_json::Value {
    config_file(&app)
        .ok()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| serde_json::json!({}))
}

#[tauri::command]
fn save_settings(app: AppHandle, data: serde_json::Value) -> Result<(), String> {
    let path = config_file(&app)?;
    let text = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    fs::write(path, text).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState {
            jobs: JobRegistry::default(),
        })
        .invoke_handler(tauri::generate_handler![
            list_dir,
            stat_path,
            get_drives,
            volume_info,
            dir_stats,
            path_exists,
            join_path,
            create_dir,
            create_file,
            rename_path,
            copy_items,
            move_items,
            delete_items,
            cancel_job,
            find_files,
            archive_is_supported,
            archive_list,
            archive_extract,
            archive_create,
            read_text_chunk,
            read_hex_chunk,
            write_text_file,
            file_checksum,
            compare_files,
            compare_dirs,
            split_file,
            combine_files,
            apply_renames,
            open_path,
            reveal_in_manager,
            open_terminal,
            system_info,
            clipboard_write_text,
            load_settings,
            save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("Total Commander ishga tushirishda xatolik");
}
