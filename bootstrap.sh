#!/usr/bin/env bash
set -euo pipefail

SKIP_BUILD=${SKIP_BUILD:-0}

log() { printf "\e[32m==>\e[0m %s\n" "$*"; }
err() { printf "\e[31mError:\e[0m %s\n" "$*" >&2; }

require_cmd() {
  local cmd="$1" hint="$2"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    err "$cmd not found. $hint"
    exit 1
  fi
}

check_node() {
  require_cmd node "Install Node.js 18+ (e.g., brew install node or nvm install 18)."
  local v
  v=$(node -v | sed 's/^v//')
  if [ "$(printf '%s\n18.0\n' "$v" | sort -V | head -n1)" != "18.0" ]; then
    err "Node $v detected; need 18+."
    exit 1
  fi
}

ensure_rust() {
  if ! command -v rustup >/dev/null 2>&1; then
    log "rustup not found; installing..."
    curl https://sh.rustup.rs -sSf | sh -s -- -y
    # shellcheck disable=SC1090
    source "$HOME/.cargo/env"
  fi
  rustup show >/dev/null
  rustup default stable >/dev/null
}

check_tauri_deps() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    if ! xcode-select -p >/dev/null 2>&1; then
      err "Xcode Command Line Tools missing. Run: xcode-select --install"
      exit 1
    fi
    log "macOS WKWebView is built-in; no WebView install needed."
  else
    log "If building elsewhere, ensure native deps per https://tauri.app"
  fi
}

run_step() { log "$1"; shift; "$@"; }

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd "$SCRIPT_DIR"

run_step "Checking Node" check_node
run_step "Ensuring Rust toolchain" ensure_rust
run_step "Validating Tauri host dependencies" check_tauri_deps
run_step "Installing npm dependencies" npm ci

if [ "$SKIP_BUILD" -eq 0 ]; then
  run_step "Building UI" npm run build
  run_step "Building Rust workspace" cargo build
else
  log "SKIP_BUILD=1 set; skipping builds."
fi

log "Bootstrap complete."
