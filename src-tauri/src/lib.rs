// Concord — Tauri backend
// Spawns a Node.js P2P sidecar and bridges stdin/stdout to the frontend via Tauri events.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;
use std::thread;

use tauri::Emitter;

const CREATE_NO_WINDOW: u32 = 0x08000000;

// ── Global state ─────────────────────────────────────────────────

static SIDECAR_CHILD: Mutex<Option<Child>> = Mutex::new(None);
static SIDECAR_STDIN: Mutex<Option<ChildStdin>> = Mutex::new(None);

// ── Helpers ──────────────────────────────────────────────────────

fn app_data_dir() -> Result<PathBuf, String> {
    let appdata = std::env::var("APPDATA").map_err(|_| "APPDATA not set")?;
    let dir = PathBuf::from(appdata).join("Concord");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn sidecar_log_path() -> Result<PathBuf, String> {
    // Include PID so each instance gets its own log file
    Ok(app_data_dir()?.join(format!("sidecar-{}.log", std::process::id())))
}

fn kill_sidecar() {
    if let Ok(mut guard) = SIDECAR_STDIN.lock() {
        *guard = None;
    }
    if let Ok(mut guard) = SIDECAR_CHILD.lock() {
        if let Some(ref mut child) = *guard {
            let _ = child.kill();
            let _ = child.wait();
        }
        *guard = None;
    }
}

fn write_to_sidecar(cmd: &serde_json::Value) -> Result<(), String> {
    let json = serde_json::to_string(cmd).map_err(|e| e.to_string())?;
    let mut guard = SIDECAR_STDIN
        .lock()
        .map_err(|e| format!("Mutex poisoned: {}", e))?;
    if let Some(ref mut stdin) = *guard {
        writeln!(stdin, "{}", json).map_err(|e| format!("Write to sidecar: {}", e))?;
        stdin
            .flush()
            .map_err(|e| format!("Flush sidecar: {}", e))?;
        Ok(())
    } else {
        Err("Sidecar not running".to_string())
    }
}

// ── Core sidecar start logic (called from setup hook) ────────────

fn start_sidecar(app: tauri::AppHandle) -> Result<(), String> {
    kill_sidecar();

    // Breadcrumb for debugging
    let _ = fs::write(
        app_data_dir()?.join("sidecar_debug.txt"),
        format!("start_sidecar called at {:?}\n", std::time::SystemTime::now()),
    );

    // Find sidecar script by walking up from exe directory
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_dir = exe.parent().ok_or("no exe parent")?;
    let sidecar_script = exe_dir
        .ancestors()
        .find_map(|dir| {
            let script = dir.join("scripts").join("p2p-sidecar.js");
            if script.exists() {
                Some(script)
            } else {
                None
            }
        })
        .ok_or_else(|| {
            format!(
                "Sidecar script (scripts/p2p-sidecar.js) not found. Searched from {} upward.",
                exe_dir.display()
            )
        })?;
    let project_root = sidecar_script
        .parent()
        .and_then(|p| p.parent())
        .ok_or("invalid sidecar script path")?
        .to_path_buf();

    let node = which::which("node").map_err(|_| {
        "Node.js not found. Install Node.js for P2P networking.".to_string()
    })?;

    let log_path = sidecar_log_path()?;
    let log_file =
        fs::File::create(&log_path).map_err(|e| format!("Cannot create sidecar log: {}", e))?;

    // Pass the app data directory so the sidecar can persist identity there
    let data_dir = app_data_dir()?;

    let mut child = Command::new(&node)
        .arg(&sidecar_script)
        .env("CONCORD_DATA_DIR", data_dir.to_string_lossy().as_ref())
        .current_dir(&project_root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::from(log_file))
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    let stdin = child.stdin.take().ok_or("No stdin pipe")?;
    let stdout = child.stdout.take().ok_or("No stdout pipe")?;

    {
        let mut guard = SIDECAR_STDIN.lock().map_err(|e| format!("Mutex: {}", e))?;
        *guard = Some(stdin);
    }
    {
        let mut guard = SIDECAR_CHILD.lock().map_err(|e| format!("Mutex: {}", e))?;
        *guard = Some(child);
    }

    // Background thread: read sidecar stdout and emit Tauri events
    let app_handle = app.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            match line {
                Ok(text) => {
                    let trimmed = text.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    match serde_json::from_str::<serde_json::Value>(trimmed) {
                        Ok(json) => {
                            let _ = app_handle.emit("p2p-event", json);
                        }
                        Err(_) => {
                            let _ = app_handle.emit(
                                "p2p-event",
                                serde_json::json!({"type": "log", "message": trimmed}),
                            );
                        }
                    }
                }
                Err(e) => {
                    let _ = app_handle.emit(
                        "p2p-event",
                        serde_json::json!({"type": "error", "message": format!("stdout read error: {}", e)}),
                    );
                    break;
                }
            }
        }
        let _ = app_handle.emit(
            "p2p-event",
            serde_json::json!({"type": "error", "message": "Sidecar process exited"}),
        );
    });

    // Append to breadcrumb
    let _ = fs::OpenOptions::new()
        .append(true)
        .open(app_data_dir().unwrap_or_default().join("sidecar_debug.txt"))
        .and_then(|mut f| {
            use std::io::Write;
            writeln!(f, "sidecar spawned OK, node={}, script={}", node.display(), sidecar_script.display())
        });

    Ok(())
}

// ── Tauri commands ───────────────────────────────────────────────

/// Send a gossipsub message through the sidecar.
#[tauri::command]
fn p2p_send(channel_id: String, data: String) -> Result<(), String> {
    write_to_sidecar(&serde_json::json!({
        "cmd": "send",
        "channelId": channel_id,
        "data": data
    }))
}

/// Tell the sidecar to dial a remote peer.
#[tauri::command]
fn p2p_dial(address: String) -> Result<(), String> {
    write_to_sidecar(&serde_json::json!({
        "cmd": "dial",
        "address": address
    }))
}

/// Read the sidecar stderr log for debugging.
#[tauri::command]
fn get_sidecar_log() -> Result<String, String> {
    let path = sidecar_log_path()?;
    match fs::read_to_string(&path) {
        Ok(s) => Ok(s),
        Err(_) => Ok(String::new()),
    }
}

// ── App entry point ──────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Auto-start the P2P sidecar when the app opens
            let handle = app.handle().clone();
            thread::spawn(move || {
                if let Err(e) = start_sidecar(handle.clone()) {
                    eprintln!("Sidecar start failed: {}", e);
                    let _ = handle.emit(
                        "p2p-event",
                        serde_json::json!({"type": "error", "message": format!("Sidecar start failed: {}", e)}),
                    );
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            p2p_send,
            p2p_dial,
            get_sidecar_log,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    kill_sidecar();
}
