# Setup (Ubuntu/Linux, Tauri v2)

This project uses **npm** as the package manager (`package-lock.json` is committed).

## Verified baseline (minimum)

These versions are the current baseline verified in this environment and should be treated as minimums for E01-T01:

- OS: Ubuntu 24.04 LTS (Linux)
- Node.js: 24.14.0+
- npm: 11.9.0+
- rustc: 1.89.0+
- cargo: 1.89.0+
- Tauri CLI: 2.10.0+ (via `npm`)
- pkg-config: 1.8.1+
- GCC: 13.3.0+

## Ubuntu/Linux prerequisites

Install required native dependencies for Tauri v2 desktop development:

```bash
sudo apt update
sudo apt install -y \
  build-essential \
  pkg-config \
  libssl-dev \
  libgtk-3-dev \
  libsoup-3.0-dev \
  libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf
```

If your distro does not provide `libayatana-appindicator3-dev`, use `libappindicator3-dev`.

## Quick environment check

From the repo root:

```bash
bash app/scripts/check-env.sh
```

From `app/`:

```bash
bash scripts/check-env.sh
```

## First run

```bash
cd app
npm install
npm run tauri dev
```

## Linux smoke run evidence (E01-T06)

Verified on **2026-03-04** from `app/`.

### 1) Bounded dev startup check

Command:

```bash
timeout 120s npm run tauri dev -- --no-watch
```

Expected output markers:

- `VITE v... ready in ...`
- `Running target/debug/app`
- exit code `124` (from `timeout`) after startup, which is expected for a bounded smoke run.

### 2) Production bundle build check

Command:

```bash
npm run tauri build
```

Expected output markers:

- `Finished \`release\` profile [optimized] target(s) in ...`
- `Finished 3 bundles at:`
- bundle files present under `src-tauri/target/release/bundle/` (`.deb`, `.rpm`, `.AppImage`)
- exit code `0`.

## Troubleshooting

### 1) Missing Linux native packages (WebKitGTK/GTK/Soup)

Symptoms:

- `pkg-config` cannot find `webkit2gtk-4.1`, `libsoup-3.0`, or `gtk+-3.0`
- build fails in Rust crates related to GTK/WebKit

Fix:

```bash
sudo apt update
sudo apt install -y \
  build-essential pkg-config libssl-dev \
  libgtk-3-dev libsoup-3.0-dev libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev librsvg2-dev patchelf
```

### 2) `tauri dev` cannot open display in headless shell

Symptoms:

- `Gtk-WARNING **: cannot open display`
- app process exits immediately after `target/debug/app`

Fix:

- run in a desktop session with `DISPLAY` set, or
- use a virtual display for smoke checks:

```bash
xvfb-run -a timeout 120s npm run tauri dev -- --no-watch
```

### 3) Rust toolchain/linker issues

Symptoms:

- `cargo: command not found`
- linker/compile errors such as missing `cc`

Fix:

```bash
curl https://sh.rustup.rs -sSf | sh
source "$HOME/.cargo/env"
rustup default stable
sudo apt install -y build-essential pkg-config
```
