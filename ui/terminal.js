import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "xterm/css/xterm.css";

let term;
let fitAddon;

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
    term.write(event.payload.data);
  });

  window.addEventListener("resize", () => {
    fitAddon.fit();
  });
}
