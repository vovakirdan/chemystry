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
