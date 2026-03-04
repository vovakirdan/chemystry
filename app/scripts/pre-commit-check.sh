#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
APP_DIR="$REPO_ROOT/app"

if [ ! -d "$APP_DIR" ]; then
  printf '[pre-commit] app directory not found at %s\n' "$APP_DIR"
  exit 1
fi

declare -a app_files=()
declare -a eslint_files=()

while IFS= read -r -d '' path; do
  case "$path" in
    app/*)
      rel_path="${path#app/}"
      app_files+=("$rel_path")
      case "$rel_path" in
        *.js|*.jsx|*.mjs|*.cjs|*.ts|*.tsx)
          eslint_files+=("$rel_path")
          ;;
      esac
      ;;
  esac
done < <(git diff --cached --name-only -z --diff-filter=ACMR)

if [ "${#app_files[@]}" -eq 0 ]; then
  printf '[pre-commit] No staged files in app/. Skipping checks.\n'
  exit 0
fi

printf '[pre-commit] Running Prettier check on staged app files...\n'
(
  cd "$APP_DIR"
  npx --no-install prettier --check --ignore-unknown -- "${app_files[@]}"
)

if [ "${#eslint_files[@]}" -eq 0 ]; then
  printf '[pre-commit] No staged JS/TS files for ESLint.\n'
  exit 0
fi

printf '[pre-commit] Running ESLint on staged JS/TS files...\n'
(
  cd "$APP_DIR"
  npx --no-install eslint --max-warnings 0 -- "${eslint_files[@]}"
)
