import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "xterm/css/xterm.css";
import { dom } from "./dom";
import {createRepo, setActiveRepo} from "./repo_states";

let term;
let fitAddon;
let lastGitRoot = null;
let cwdHookInstalled = false;

const cwdOscPattern = /\u001b]777;cwd=([^\u0007]+)\u0007/g;
const osc7Pattern = /\u001b]7;file:\/\/[^\u/]*([^\u0007\x1b]+)[\u0007\x1b\\]/g;
const isWindows = navigator.userAgent.includes("Windows");

export async function initTerminal() {
  const container = document.getElementById("terminal");

  term = new Terminal({
    cursorBlink: true,
    scrollback: 5000,
    fontFamily: "monospace",
    fontSize: 13,
  });

  fitAddon = new FitAddon();
  term.loadAddon(fitAddon);

  term.open(container);
  fitAddon.fit();
  term.focus();

  const unlisten = await listen("pty-data", event => {
    const data = event.payload.data;
    detectCwdOsc(data);
    term.write(data);
  }).catch(err => {
    console.error("Failed to attach PTY listener", err);
    return null;
  });

  try {
    await invoke("spawn_terminal");
  } catch (err) {
    console.error("spawn_terminal failed", err);
    if (typeof unlisten === "function") unlisten();
    return;
  }

  term.onData(data => {
    invoke("write_terminal", { data }).catch(err => {
      console.error("write_terminal failed", err);
    });
  });

  term.parser.registerOscHandler(777, data => {
    if (data.startsWith("cwd=")) {
      const cwd = data.slice(4);
      handleCwdChange(cwd);
    }
    return true; // handled: do not render
  });

  term.parser.registerOscHandler(7, data => {
    const match = data.match(/^file:\/\/[^/]*(\/.*)$/);
    if (match) {
      handleCwdChange(match[1]);
    }
    return true;
  });

  // Install prompt hook once per session to emit cwd without showing the command.
  if (isWindows) {
    emitCwdOnce();
  } else {
    installCwdHook();
    emitCwdOnce();
  }

  window.addEventListener("resize", () => {
    fitAddon.fit();
  });
}

function installCwdHook() {
  if (isWindows) return;
  if (cwdHookInstalled) return;
  cwdHookInstalled = true;

  const posixHook = `
__codex_cwd() {
  printf "\\033]777;cwd=%s\\007" "$PWD"
  printf "\\033]7;file://%s\\007" "$PWD"
}

if [ -n "$ZSH_VERSION" ]; then
  autoload -Uz add-zsh-hook
  add-zsh-hook precmd __codex_cwd
else
  PROMPT_COMMAND="__codex_cwd\${PROMPT_COMMAND:+;\$PROMPT_COMMAND}"
fi

__codex_cwd
`.trim();

  sendPosixSilently(posixHook);
}

function installWindowsCwdHook() {
  if (!isWindows) return;
  if (cwdHookInstalled) return;
  cwdHookInstalled = true;

  // PowerShell prompt hook to emit OSC 777/7 before rendering the prompt.
  const psHook = `
$esc = [char]27
$bel = [char]7
function __codex_emit_cwd {
  $p = (Get-Location).Path
  $uriPath = $p -replace '\\\\','/'
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
`.trim();

  invoke("write_terminal", { data: psHook + "\r\n" });
}

function detectCwdOsc(data) {
  cwdOscPattern.lastIndex = 0;
  let match;
  while ((match = cwdOscPattern.exec(data)) !== null) {
    // console.debug("OSC 777 cwd detected:", match[1]);
    handleCwdChange(match[1]);
  }

  osc7Pattern.lastIndex = 0;
  while ((match = osc7Pattern.exec(data)) !== null) {
    // console.debug("OSC 7 cwd detected:", match[1]);
    handleCwdChange(match[1]);
  }
}

async function handleCwdChange(cwd) {
  const normalizedCwd = normalizeCwd(cwd);

  try {
    const result = await invoke("update_git_context", { path: normalizedCwd });

    if(result) {
      const branches = await invoke("git_branches", { path: result.root });
      const active_branch = await invoke("git_current_branch", { path: result.root });

      const currentBranch = Array.isArray(active_branch) ? active_branch[0] || "" : active_branch || "";
      const repo = createRepo(result.name, result.root, branches || [], currentBranch);
      setActiveRepo(repo);
    }
    else {
      setActiveRepo(null);
    }
    
    if (result && result.root !== lastGitRoot) {
      lastGitRoot = result.root;
      updateEditorTabTitle(result.name);
    } else if (!result && lastGitRoot) {
      lastGitRoot = null;
      updateEditorTabTitle(null);
    }
  } catch (err) {
    console.error("Failed to update git context", err);
  }
}

function updateEditorTabTitle(repoName) {
  const tab = document.querySelector("#editor-tabs .editor-tab.active");
  if (!tab) return;

  const label = tab.querySelector(".editor-tab-label");
  const target = label || tab;
  const name = repoName || "";

  target.textContent = name;
  if (tab.__repo) {
    tab.__repo.name = name;
  }
}

function sendPosixSilently(script) {
  const guard = 'command -v stty >/dev/null 2>&1';
  const payload = [
    `${guard} && stty -echo`,
    script,
    `${guard} && stty echo`,
  ].join("\n");

  const command = payload.replace(/\n/g, "\r\n") + "\r\n";
  invoke("write_terminal", { data: command }).catch(err => {
    console.error("Failed to install POSIX cwd hook", err);
  });
}

function emitCwdOnce() {
  if (isWindows) {
    const psEmit = `
$esc = [char]27
$bel = [char]7
$p = (Get-Location).Path
$uriPath = $p -replace '\\\\','/'
[Console]::Write("$esc]777;cwd=$uriPath$bel")
[Console]::Write("$esc]7;file:///$uriPath$bel")
`.trim();

    invoke("write_terminal", { data: psEmit.replace(/\n/g, "\r\n") + "\r\n" }).catch(err => {
      console.error("Failed to emit Windows cwd", err);
    });
    return;
  }

  const posixEmit = 'printf "\\033]777;cwd=%s\\007" "$PWD"; printf "\\033]7;file://%s\\007" "$PWD"';
  invoke("write_terminal", { data: posixEmit + "\r\n" }).catch(err => {
    console.error("Failed to emit POSIX cwd", err);
  });
}

function normalizeCwd(cwd) {
  if (!cwd) return cwd;
  if (isWindows) {
    // Handle file URI style paths like /C:/path -> C:/path for git -C on Windows.
    const drive = cwd.match(/^\/([A-Za-z]:\/.*)$/);
    if (drive) return drive[1];
  }
  return cwd;
}
