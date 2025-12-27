use crate::state::AppState;
use std::sync::Arc;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn spawn_terminal(
  app: AppHandle,
  state: State<Arc<AppState>>,
) -> Result<(), String> {
  let mut sessions = state.sessions.lock().unwrap();
  sessions
    .spawn(&app, "main".into(), 80, 24)
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_terminal(
  state: State<Arc<AppState>>,
  data: String,
) -> Result<(), String> {
  let mut sessions = state.sessions.lock().unwrap();
  sessions
    .write("main", &data)
    .map_err(|e| e.to_string())
}
