#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"

if ! git -C "$APP_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  printf '[hooks] Git work tree not found from %s. Skipping hook install.\n' "$APP_DIR"
  exit 0
fi

HOOKS_PATH="app/.githooks"

git -C "$APP_DIR" config core.hooksPath "$HOOKS_PATH"

if [ -f "$APP_DIR/.githooks/pre-commit" ]; then
  chmod +x "$APP_DIR/.githooks/pre-commit"
fi

printf '[hooks] Installed core.hooksPath=%s\n' "$HOOKS_PATH"
