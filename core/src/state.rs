use crate::pty::PtyManager;
use std::sync::Mutex;

pub struct AppState {
  pub pty: Mutex<PtyManager>,
  pub current_git_root: Mutex<Option<String>>,
}

impl AppState {
  pub fn new() -> Self {
    Self {
      pty: Mutex::new(PtyManager::new()),
      current_git_root: Mutex::new(None),
    }
  }
}

impl Default for AppState {
  fn default() -> Self {
    Self::new()
  }
}
