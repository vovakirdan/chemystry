# Project Initialization Proof (E01-T02)

This app was scaffolded with Tauri v2 quickstart (`create-tauri-app`).

## Exact Quickstart Choices

- UI template: `react-ts` (React + TypeScript, Vite)
- Package manager: `npm`
- App identifier: `io.github.zov.chemystry` (`src-tauri/tauri.conf.json`)
- Tauri track: v2 (`--tauri-version 2`)
- Resolved versions in this repo:
  - `@tauri-apps/cli`: `2.10.0` (`package-lock.json`)
  - `@tauri-apps/api`: `2.10.1` (`package-lock.json`)
  - Rust crates: `tauri = "2"`, `tauri-build = "2"` (`src-tauri/Cargo.toml`)

## Reproducible Initialization Commands

Run from `/home/zov/projects/cheMystry` (or any parent directory):

```bash
npm create tauri-app@latest app -- \
  --template react-ts \
  --manager npm \
  --identifier io.github.zov.chemystry \
  --tauri-version 2 \
  --yes
cd app
npm install
```

## Verification Checklist

Run from `app/`:

```bash
npm run tauri -- --version
test -d src-tauri && test -f src/main.tsx && echo "structure-ok"
npm run tauri dev
npm run tauri build
```

Expected result:

- `npm run tauri -- --version` prints `tauri-cli 2.x`.
- `structure-ok` is printed.
- `npm run tauri dev` starts without scaffold structure fixes.
- `npm run tauri build` completes successfully.
