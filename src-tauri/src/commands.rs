use crate::state::AppState;
use serde::Serialize;
use std::process::Command;
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize)]
pub struct GitContext {
  pub root: String,
  pub name: String,
}

#[tauri::command]
pub fn spawn_terminal(app: AppHandle, state: State<AppState>) -> Result<(), String> {
  let app_handle = app.clone();
  let mut pty = state.pty.lock().map_err(|e| e.to_string())?;

  pty
    .spawn("main", 80, 24, move |id, data| {
      let payload = serde_json::json!({ "id": id, "data": data });
      let _ = app_handle.emit("pty-data", payload);
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_terminal(state: State<AppState>, data: String) -> Result<(), String> {
  let mut pty = state.pty.lock().map_err(|e| e.to_string())?;
  pty.write("main", &data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_current_branch(path: String) -> Result<Vec<String>, String> {
  let output = Command::new("git")
    .arg("-C")
    .arg(&path)
    .arg("branch")
    .arg("--show-current")
    .output()
    .map_err(|e| e.to_string())?;

  if output.status.success() {
    let stdout = String::from_utf8_lossy(&output.stdout);
    let branches = stdout
      .lines()
      .map(|line| line.trim_start_matches("* ").trim().to_string())
      .collect();
    Ok(branches)
  } else {
    Err(String::from_utf8_lossy(&output.stderr).to_string())
  }
}

#[tauri::command]
pub fn git_branches(path: String) -> Result<Vec<String>, String> {
  let output = Command::new("git")
    .arg("-C")
    .arg(&path)
    .arg("branch")
    .arg("-a")
    .output()
    .map_err(|e| e.to_string())?;

  if output.status.success() {
    let stdout = String::from_utf8_lossy(&output.stdout);
    let branches = stdout
      .lines()
      .map(|line| line.trim_start_matches("* ").trim().to_string())
      .collect();
    Ok(branches)
  } else {
    Err(String::from_utf8_lossy(&output.stderr).to_string())
  }
}

#[tauri::command]
pub fn update_git_context(state: State<AppState>, path: String) -> Result<Option<GitContext>, String> {
  let git_root = git_root_for_path(&path)?;

  let mut current = state
    .current_git_root
    .lock()
    .map_err(|e| e.to_string())?;
  *current = git_root.clone();

  Ok(git_root.map(|root| {
    let name = std::path::Path::new(&root)
      .file_name()
      .and_then(|s| s.to_str())
      .unwrap_or(&root)
      .to_string();

    GitContext { root, name }
  }))
}

fn git_root_for_path(path: &str) -> Result<Option<String>, String> {
  let output = Command::new("git")
    .arg("-C")
    .arg(path)
    .arg("rev-parse")
    .arg("--show-toplevel")
    .output()
    .map_err(|e| e.to_string())?;

  if output.status.success() {
    let root = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if root.is_empty() {
      Ok(None)
    } else {
      Ok(Some(root))
    }
  } else {
    Ok(None)
  }
}
