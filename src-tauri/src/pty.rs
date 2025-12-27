use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::{
  collections::HashMap,
  io::{Read, Write},
  sync::{Arc, Mutex},
};
use tauri::{AppHandle, Emitter};

pub struct PtySessions {
  sessions: HashMap<String, PtySession>,
}

struct PtySession {
  writer: Box<dyn Write + Send>,
}

impl PtySessions {
  pub fn new() -> Self {
    Self {
      sessions: HashMap::new(),
    }
  }

  pub fn spawn(
    &mut self,
    app: &AppHandle,
    id: String,
    cols: u16,
    rows: u16,
  ) -> anyhow::Result<()> {
    let pty_system = native_pty_system();
    let pair = pty_system.openpty(PtySize {
      rows,
      cols,
      pixel_width: 0,
      pixel_height: 0,
    })?;

    #[cfg(target_os = "windows")]
    let mut cmd = CommandBuilder::new("powershell.exe");

    #[cfg(not(target_os = "windows"))]
    let mut cmd = CommandBuilder::new(
      std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into()),
    );

    cmd.env("TERM", "xterm-256color");

    let _child = pair.slave.spawn_command(cmd)?;
    let mut reader = pair.master.try_clone_reader()?;
    let writer = pair.master.take_writer()?;

    let app_handle = app.clone();
    let session_id = id.clone();

    std::thread::spawn(move || {
      let mut buf = [0u8; 8192];
      loop {
        match reader.read(&mut buf) {
          Ok(0) => break,
          Ok(n) => {
            let data = String::from_utf8_lossy(&buf[..n]).to_string();
            let _ = app_handle.emit(
              "pty-data",
              serde_json::json!({
                "id": session_id,
                "data": data
              }),
            );
          }
          Err(_) => break,
        }
      }
    });

    self.sessions.insert(id, PtySession { writer });
    Ok(())
  }

  pub fn write(&mut self, id: &str, data: &str) -> anyhow::Result<()> {
    if let Some(session) = self.sessions.get_mut(id) {
      session.writer.wri
