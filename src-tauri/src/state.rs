use crate::pty::PtySessions;
use std::sync::Mutex;

pub struct AppState {
  pub sessions: Mutex<PtySessions>,
}

impl AppState {
  pub fn new() -> Self {
    Self {
      sessions: Mutex::new(PtySessions::new()),
    }
  }
}
