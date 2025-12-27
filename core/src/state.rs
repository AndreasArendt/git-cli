use crate::pty::PtyManager;
use std::sync::Mutex;

pub struct AppState {
  pub pty: Mutex<PtyManager>,
}

impl AppState {
  pub fn new() -> Self {
    Self {
      pty: Mutex::new(PtyManager::new()),
    }
  }
}

impl Default for AppState {
  fn default() -> Self {
    Self::new()
  }
}
