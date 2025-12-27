FROM mcr.microsoft.com/devcontainers/base:ubuntu-22.04

# -----------------------------
# System dependencies
# -----------------------------
RUN apt-get update && apt-get install -y \
    # --- base ---
    build-essential \
    curl \
    git \
    ca-certificates \
    sudo \
    pkg-config \
    libssl-dev \
    \
    # --- debugging ---
    lldb \
    gdb \
    clang \
    \
    # --- GLib / GTK stack ---
    libglib2.0-dev \
    libgtk-3-dev \
    libgdk-pixbuf-2.0-dev \
    libpango1.0-dev \
    libcairo2-dev \
    libatk1.0-dev \
    \
    # --- WebKit (Tauri) ---
    libwebkit2gtk-4.1-dev \
    libsoup-3.0-dev \
    \
    # --- X11 (required indirectly) ---
    libx11-dev \
    libxrandr-dev \
    libxss-dev \
    libxinerama-dev \
    libxcursor-dev \
    libxdamage-dev \
    libxcomposite-dev \
    \
    && rm -rf /var/lib/apt/lists/*

# -----------------------------
# Node.js 22
# -----------------------------
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs

# -----------------------------
# Rust (install for root first)
# -----------------------------
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# -----------------------------
# Make Rust available to vscode user
# -----------------------------
ARG USERNAME=vscode
RUN mkdir -p /home/${USERNAME}/.cargo /home/${USERNAME}/.rustup \
    && cp -r /root/.cargo/* /home/${USERNAME}/.cargo/ \
    && cp -r /root/.rustup/* /home/${USERNAME}/.rustup/ \
    && chown -R ${USERNAME}:${USERNAME} /home/${USERNAME}/.cargo /home/${USERNAME}/.rustup

ENV CARGO_HOME=/home/${USERNAME}/.cargo
ENV RUSTUP_HOME=/home/${USERNAME}/.rustup
ENV PATH="/home/${USERNAME}/.cargo/bin:${PATH}"

# -----------------------------
# Switch to vscode user
# -----------------------------
USER ${USERNAME}
WORKDIR /workspace

# -----------------------------
# Rust components for IDE/debugging
# -----------------------------
RUN rustup component add rustfmt clippy

# -----------------------------
# Tauri CLI (installed as vscode user)
# -----------------------------
RUN cargo install tauri-cli

# -----------------------------
# Debug-friendly defaults
# -----------------------------
ENV RUST_BACKTRACE=1
ENV CARGO_INCREMENTAL=1

CMD ["bash"]
