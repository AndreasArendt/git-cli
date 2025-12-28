mod commands;
mod state;

pub use commands::{spawn_terminal, update_git_context, write_terminal};
pub use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(AppState::default())
    .invoke_handler(tauri::generate_handler![
      spawn_terminal,
      write_terminal,
      update_git_context
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        let window = app.handle().get_webview_window("main").unwrap();
        window.open_devtools();
        window.close_devtools();

        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
