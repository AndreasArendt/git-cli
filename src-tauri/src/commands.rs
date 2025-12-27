use crate::state::AppState;
use tauri::{AppHandle, Emitter, State};

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
