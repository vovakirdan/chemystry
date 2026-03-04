# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Environment Setup

- Use **npm** (this repo tracks `package-lock.json`).
- Setup guide: `docs/setup.md`
- Project initialization proof (E01-T02): `docs/project-init.md`
- Quick check: `bash scripts/check-env.sh`

## Scripts

Run once on a clean clone:

- `npm install`

Frontend/tooling:

- `npm run dev` - run Vite dev server.
- `npm run build` - type-check and build frontend.
- `npm run lint` - run ESLint on TS/React sources.
- `npm run test` - run Vitest (`--passWithNoTests` enabled).
- `npm run format` - format files with Prettier.
- `npm run format:check` - verify Prettier formatting.

Rust aliases (from `app/` root):

- `npm run rust:fmt` - format Rust code.
- `npm run rust:fmt:check` - check Rust formatting.
- `npm run rust:clippy` - run clippy on all targets/features.
- `npm run rust:test` - run Rust tests.

## Structure Scaffold (E01-T03)

- Frontend shell/modules: `src/app/README.md`, `src/features/README.md`, `src/shared/README.md`
- Backend layers: `src-tauri/src/domain/README.md`, `src-tauri/src/adapters/README.md`, `src-tauri/src/infra/README.md`
- Testing/assets roots: `tests/e2e/README.md`, `assets/README.md`

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
