import { initTerminal } from "./terminal.js";
import { initUI } from "./ui.js";

window.addEventListener("DOMContentLoaded", async () => {
  initUI();
  await initTerminal();
});
