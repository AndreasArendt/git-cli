use anyhow::{anyhow, Result};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
#[cfg(target_os = "windows")]
use portable_pty::MasterPty;
use std::{
  collections::HashMap,
  io::{Read, Write},
  thread,
};

#[cfg(target_os = "windows")]
const POWERSHELL_PROMPT_HOOK: &str = r#"
$esc = [char]27
$bel = [char]7
function __codex_emit_cwd {
  $p = (Get-Location).Path
  $uriPath = $p -replace '\\','/'
  [Console]::Write("$esc]777;cwd=$uriPath$bel")
  [Console]::Write("$esc]7;file:///$uriPath$bel")
}
if (-not (Test-Path function:__codex_original_prompt)) {
  if (Test-Path function:prompt) { $function:__codex_original_prompt = $function:prompt }
}
function prompt {
  __codex_emit_cwd
  if (Test-Path function:__codex_original_prompt) { & $__codex_original_prompt }
  else { "PS " + (Get-Location) + "> " }
}
__codex_emit_cwd
"#;

pub struct PtyManager {
  sessions: HashMap<String, PtySession>,
}

struct PtySession {
  writer: Box<dyn Write + Send>,
  #[cfg(target_os = "windows")]
  _master: Box<dyn MasterPty + Send>,
}

impl PtyManager {
  pub fn new() -> Self {
    Self {
      sessions: HashMap::new(),
    }
  }

  /// Spawn a new PTY session and stream output through the provided callback.
  pub fn spawn<F>(
    &mut self,
    id: impl Into<String>,
    cols: u16,
    rows: u16,
    on_output: F,
  ) -> Result<()>
  where
    F: Fn(String, String) + Send + 'static,
  {
    let id = id.into();
    let pty_system = native_pty_system();
    let pair = pty_system.openpty(PtySize {
      rows,
      cols,
      pixel_width: 0,
      pixel_height: 0,
    })?;

    #[cfg(target_os = "windows")]
    let mut spawn_err: Option<String> = None;

    #[cfg(target_os = "windows")]
    let _child = {
      let hook_command = {
        let compact = POWERSHELL_PROMPT_HOOK
          .lines()
          .map(str::trim)
          .filter(|line| !line.is_empty())
          .collect::<Vec<_>>()
          .join("; ");

        format!("& {{ {compact} }}")
      };

      let attempts: [(&str, Vec<String>); 3] = [
        (
          "pwsh.exe",
          vec![
            "-NoLogo".into(),
            "-NoProfile".into(),
            "-NoExit".into(),
            "-Command".into(),
            hook_command.clone(),
          ],
        ),
        (
          "powershell.exe",
          vec![
            "-NoLogo".into(),
            "-NoProfile".into(),
            "-NoExit".into(),
            "-Command".into(),
            hook_command.clone(),
          ],
        ),
        ("cmd.exe", vec!["/d".into(), "/k".into()]),
      ];

      let mut child = None;
      for (prog, args) in attempts {
        let mut c = CommandBuilder::new(prog);
        c.args(args.iter().map(|s| s.as_str()));
        c.env("TERM", "xterm-256color");
        match pair.slave.spawn_command(c) {
          Ok(ch) => {
            child = Some(ch);
            break;
          }
          Err(err) => {
            spawn_err = Some(format!("{prog} failed: {err}"));
          }
        }
      }

      child.ok_or_else(|| anyhow!(spawn_err.unwrap_or_else(|| "no shell attempts were made".into())))?
    };

    #[cfg(not(target_os = "windows"))]
    let shell_path = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());

    #[cfg(not(target_os = "windows"))]
    let mut cmd = {
      let mut c = CommandBuilder::new(&shell_path);

      // Force an interactive shell so precmd / PROMPT_COMMAND hooks run and cwd OSC markers emit.
      if shell_path.contains("zsh") {
        c.arg("-i");
      } else if shell_path.contains("bash") {
        c.arg("-i");
      }

      c.env("TERM", "xterm-256color");

      c
    };

    #[cfg(not(target_os = "windows"))]
    let _child = pair.slave.spawn_command(cmd)?;
    let mut reader = pair.master.try_clone_reader()?;
    let writer = pair.master.take_writer()?;

    #[cfg(target_os = "windows")]
    let master_guard = pair.master;

    let session_id = id.clone();
    thread::spawn(move || {
      let mut buf = [0u8; 8192];
      loop {
        match reader.read(&mut buf) {
          Ok(0) => break,
          Ok(n) => {
            let data = String::from_utf8_lossy(&buf[..n]).to_string();
            on_output(session_id.clone(), data);
          }
          Err(_) => break,
        }
      }
    });

    self.sessions.insert(
      id,
      PtySession {
        writer,
        #[cfg(target_os = "windows")]
        _master: master_guard,
      },
    );
    Ok(())
  }

  pub fn write(&mut self, id: &str, data: &str) -> Result<()> {
    if let Some(session) = self.sessions.get_mut(id) {
      session.writer.write_all(data.as_bytes())?;
      session.writer.flush()?;
      Ok(())
    } else {
      Err(anyhow!("session {id} not found"))
    }
  }
}

impl Default for PtyManager {
  fn default() -> Self {
    Self::new()
  }
}
