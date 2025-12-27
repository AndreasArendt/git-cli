import { initTerminal } from "./terminal.js";
import { initToolUI } from "./tool_ui.js";

window.addEventListener("DOMContentLoaded", async () => {
  initToolUI();
  await initTerminal();
});

