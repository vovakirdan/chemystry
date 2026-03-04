#!/usr/bin/env bash
set -u

MIN_NODE="24.14.0"
MIN_NPM="11.9.0"
MIN_RUSTC="1.89.0"
MIN_CARGO="1.89.0"
MIN_PKG_CONFIG="1.8.1"
MIN_GCC="13.3.0"

FAILED=0

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"

ok() {
  printf '[OK] %s\n' "$1"
}

fail() {
  printf '[FAIL] %s\n' "$1"
  FAILED=1
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

version_ge() {
  # Returns success when $1 >= $2.
  [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | tail -n 1)" = "$1" ]
}

check_cmd_version() {
  label="$1"
  min="$2"
  version="$3"
  if [ -z "$version" ]; then
    fail "could not read $label version"
    return
  fi

  if version_ge "$version" "$min"; then
    ok "$label $version (>= $min)"
  else
    fail "$label $version (< $min)"
  fi
}

check_pkg_module() {
  module="$1"
  label="$2"

  if pkg-config --exists "$module"; then
    ok "$label $(pkg-config --modversion "$module")"
  else
    fail "$label missing (pkg-config module: $module)"
  fi
}

printf 'Environment check for %s\n' "$APP_DIR"
printf 'Package manager: npm\n'

if [ -f "$APP_DIR/package-lock.json" ]; then
  ok "package-lock.json present"
else
  fail "package-lock.json missing (npm lockfile expected)"
fi

if has_cmd node; then
  check_cmd_version "node" "$MIN_NODE" "$(node -v | sed 's/^v//')"
else
  fail "node is missing (need >= $MIN_NODE)"
fi

if has_cmd npm; then
  check_cmd_version "npm" "$MIN_NPM" "$(npm -v)"
else
  fail "npm is missing (need >= $MIN_NPM)"
fi

if has_cmd rustc; then
  check_cmd_version "rustc" "$MIN_RUSTC" "$(rustc --version | awk '{print $2}')"
else
  fail "rustc is missing (need >= $MIN_RUSTC)"
fi

if has_cmd cargo; then
  check_cmd_version "cargo" "$MIN_CARGO" "$(cargo --version | awk '{print $2}')"
else
  fail "cargo is missing (need >= $MIN_CARGO)"
fi

if has_cmd pkg-config; then
  check_cmd_version "pkg-config" "$MIN_PKG_CONFIG" "$(pkg-config --version)"
else
  fail "pkg-config is missing (need >= $MIN_PKG_CONFIG)"
fi

if has_cmd gcc; then
  gcc_version="$(gcc -dumpfullversion -dumpversion 2>/dev/null || true)"
  if [ -n "$gcc_version" ] && version_ge "$gcc_version" "$MIN_GCC"; then
    ok "gcc $gcc_version (>= $MIN_GCC)"
  else
    fail "gcc version too old or unreadable (need >= $MIN_GCC)"
  fi
else
  fail "gcc is missing (install build-essential)"
fi

if has_cmd pkg-config; then
  check_pkg_module "webkit2gtk-4.1" "webkit2gtk-4.1"
  check_pkg_module "gtk+-3.0" "gtk+-3.0"
  check_pkg_module "libsoup-3.0" "libsoup-3.0"
  check_pkg_module "javascriptcoregtk-4.1" "javascriptcoregtk-4.1"
  check_pkg_module "librsvg-2.0" "librsvg-2.0"

  if pkg-config --exists "ayatana-appindicator3-0.1"; then
    ok "ayatana-appindicator3-0.1 $(pkg-config --modversion ayatana-appindicator3-0.1)"
  elif pkg-config --exists "appindicator3-0.1"; then
    ok "appindicator3-0.1 $(pkg-config --modversion appindicator3-0.1)"
  else
    fail "missing appindicator pkg-config module (need ayatana-appindicator3-0.1 or appindicator3-0.1)"
  fi
fi

if has_cmd npx; then
  tauri_cli_version="$(npx --yes @tauri-apps/cli@latest --version 2>/dev/null | awk '{print $2}' || true)"
  if [ -n "$tauri_cli_version" ]; then
    ok "tauri-cli $tauri_cli_version (npm)"
  else
    fail "could not run Tauri CLI via npx"
  fi
else
  fail "npx is missing (comes with npm)"
fi

if [ "$FAILED" -ne 0 ]; then
  printf '\nOne or more critical checks failed.\n'
  printf 'Install Ubuntu prerequisites listed in app/docs/setup.md and re-run this script.\n'
  exit 1
fi

printf '\nAll critical checks passed.\n'
