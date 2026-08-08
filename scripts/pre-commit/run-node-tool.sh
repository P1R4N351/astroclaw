#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ $# -lt 1 ]]; then
  echo "usage: run-node-tool.sh <tool> [args...]" >&2
  exit 2
fi

tool="$1"
shift

# Prefer the tool binary already installed under this root's own node_modules.
#
# HAZARD [aed233a] — why this branch must come FIRST, before any package
# manager. Several /home/s/astroclaw-* git worktrees carry a node_modules that
# is a SYMLINK into the live w1 checkout (/home/s/astroclaw/node_modules).
# `pnpm exec` runs an implicit deps-status check (the `verify-deps-before-run`
# setting) which compares node_modules/.modules.yaml against THIS root; in a
# symlinked worktree the recorded virtualStoreDir belongs to the other checkout,
# so pnpm judges the modules dir incompatible and RECREATES it — following the
# symlink and wiping the TARGET checkout's node_modules. Reproduced 2026-08-01
# in a /tmp sandbox: pnpm printed "Recreating <target>" and every canary file
# planted in the symlink target was destroyed. Interactively it merely aborts
# (ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY under a hook's non-TTY stdio), but
# with CI=true — the exact remedy pnpm's own error message prints, and a value
# agent/CI wrappers routinely set — it proceeds without prompting. A second,
# quieter variant: where the modules dir merely looks stale rather than
# incompatible, pnpm silently runs a full INSTALL into the symlink target,
# mutating the live tree's dependencies from a worktree `git commit`.
#
# Resolving the local .bin shim here means the ordinary pre-commit path never
# invokes a package manager at all, so neither variant can fire.
if [[ -x "$ROOT_DIR/node_modules/.bin/$tool" ]]; then
  exec "$ROOT_DIR/node_modules/.bin/$tool" "$@"
fi

if [[ -f "$ROOT_DIR/pnpm-lock.yaml" ]] && command -v pnpm >/dev/null 2>&1; then
  # Belt-and-braces for the fallthrough (tool genuinely absent from .bin): keep
  # pnpm from mutating/removing a node_modules it does not own. Verified to
  # neutralize the "Recreating" path even with CI=true and a mismatched
  # .modules.yaml. Scoped to this exec only; does not persist to any config.
  export npm_config_verify_deps_before_run=false
  exec pnpm exec "$tool" "$@"
fi

if { [[ -f "$ROOT_DIR/bun.lockb" ]] || [[ -f "$ROOT_DIR/bun.lock" ]]; } && command -v bun >/dev/null 2>&1; then
  exec bunx --bun "$tool" "$@"
fi

if command -v npm >/dev/null 2>&1; then
  exec npm exec -- "$tool" "$@"
fi

if command -v npx >/dev/null 2>&1; then
  exec npx "$tool" "$@"
fi

echo "Missing package manager: pnpm, bun, or npm required." >&2
exit 1
