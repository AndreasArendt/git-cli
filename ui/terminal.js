import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "xterm/css/xterm.css";

let term;
let fitAddon;
let lastGitRoot = null;
let cwdHookInstalled = false;

const cwdOscPattern = /\u001b]777;cwd=([^\u0007]+)\u0007/g;
const osc7Pattern = /\u001b]7;file:\/\/[^\u/]*([^\u0007\x1b]+)[\u0007\x1b\\]/g;

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

  await invoke("spawn_terminal");

  term.onData(data => {
    invoke("write_terminal", { data });
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
  installCwdHook();
  requestAnimationFrame(() => {
    emitCwdOnce();
  });

  window.addEventListener("resize", () => {
    fitAddon.fit();
  });
}

function installCwdHook() {
  if (cwdHookInstalled) return;
  cwdHookInstalled = true;
  const hook = [
    '__codex_cwd(){ printf "\\033]777;cwd=%s\\007" "$PWD"; printf "\\033]7;file://%s\\007" "$PWD"; }',
    'if [ -n "$ZSH_VERSION" ]; then',
    '  autoload -Uz add-zsh-hook 2>/dev/null || true',
    '  typeset -ga precmd_functions',
    '  typeset -ga chpwd_functions',
    '  precmd_functions=(${precmd_functions:#__codex_cwd} __codex_cwd)',
    '  chpwd_functions=(${chpwd_functions:#__codex_cwd} __codex_cwd)',
    'elif [ -n "$BASH_VERSION" ]; then',
    '  case ";$PROMPT_COMMAND;" in *";__codex_cwd;"*) ;; *) PROMPT_COMMAND="__codex_cwd${PROMPT_COMMAND:+;$PROMPT_COMMAND}";; esac',
    'else',
    '  PROMPT_COMMAND="__codex_cwd${PROMPT_COMMAND:+;$PROMPT_COMMAND}"',
    'fi',
    '__codex_cwd'
  ].join("\n");

  // Ensure commands run immediately by sending with CRLF.
  invoke("write_terminal", { data: `${hook}\r\n` });
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

    console.log("Git context:", result);

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
  const tab = document.querySelector("#editor-tabs .tab.active");
  if (!tab) return;

  if (repoName) {
    tab.textContent = repoName;
  } else {
    tab.textContent = "main.js";
  }
}
