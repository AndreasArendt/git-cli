## git-cli Workspace

```
.
├── Cargo.toml          # Workspace members
├── core/               # Rust core library (PTY + git utilities)
├── src-tauri/          # Tauri shell that exposes commands to the UI
├── ui/                 # Frontend assets served by Tauri
├── package.json        # Frontend dependencies (xterm)
└── ...
```

### Crates
- `core`: Library that owns the PTY manager and shared state. No Tauri-specific code.
- `src-tauri`: Tauri runner that wires commands (`spawn_terminal`, `write_terminal`) to the UI and emits PTY output events.

### Frontend
The UI lives in `ui/` and calls the Tauri commands above. Terminal output is received via the `pty-data` event.

### Build
Options to work with this workspace

**From host (GUI):** Open the folder locally, install deps (npm install + cargo build like devcontainer.json), then run the Tauri UI (cargo tauri dev from repo root; needs tauri-cli installed) to get the native window for the terminal UI in ui/ with backend in core/ and src-tauri/.

**From host (no GUI):** Build/test the Rust crates directly (cargo build, cargo test, or cargo test -p core) and iterate on the backend logic without launching the Tauri window.
Inside the devcontainer (no GUI by default): Open in VS Code Dev Containers; it auto-runs npm install && cargo build (per devcontainer.json). Use the integrated terminal for cargo test, cargo build, or other headless tasks.

**Inside the devcontainer (GUI possible with forwarding):** If your Docker setup allows X11/Wayland or VS Code “Forward GUI”, you can run cargo tauri dev in the container; otherwise, run GUI builds on the host instead.

**Hybrid:** Use the container for consistent builds/tests, but run the GUI on the host; both share the same workspace folder (/workspaces/git-cli).