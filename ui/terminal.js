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

  requestAnimationFrame(() => {
    term.open(container);
    fitAddon.fit();
    term.focus();
  });

  try {
    await invoke("spawn_terminal");
  } catch (err) {
    console.error("spawn_terminal failed", err);
    return;
  }

  term.onData(data => {
    invoke("write_terminal", { data }).catch(err => {
      console.error("write_terminal failed", err);
    });
  });

  await listen("pty-data", event => {
    const data = event.payload.data;
    detectCwdOsc(data);
    term.write(data);
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
  // Skip hook injection on Windows to avoid breaking PowerShell/cmd prompts.
  if (!isWindows) {
    installCwdHook();
  }

  requestAnimationFrame(() => {
    if (!isWindows) {
      emitCwdOnce();
    }
  });

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

  // Send with CRLF so it executes immediately
  invoke("write_terminal", { data: posixHook + "\r\n" });
}

function emitCwdOnce() {
  invoke("write_terminal", { data: 'printf "\\033]777;cwd=%s\\007" "$PWD"\r\n' });
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
  try {
    const result = await invoke("update_git_context", { path: cwd });

    if(result) {
      const repo = createRepo(result.name, result.root);
      setActiveRepo(repo);
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
