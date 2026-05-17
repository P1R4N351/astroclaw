#!/usr/bin/env bash
set -euo pipefail

cd /repo

export ASTROCLAW_STATE_DIR="/tmp/astroclaw-test"
export ASTROCLAW_CONFIG_PATH="${ASTROCLAW_STATE_DIR}/astroclaw.json"

echo "==> Build"
if ! pnpm build >/tmp/astroclaw-cleanup-build.log 2>&1; then
  cat /tmp/astroclaw-cleanup-build.log
  exit 1
fi

echo "==> Seed state"
mkdir -p "${ASTROCLAW_STATE_DIR}/credentials"
mkdir -p "${ASTROCLAW_STATE_DIR}/agents/main/sessions"
echo '{}' >"${ASTROCLAW_CONFIG_PATH}"
echo 'creds' >"${ASTROCLAW_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${ASTROCLAW_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
if ! pnpm astroclaw reset --scope config+creds+sessions --yes --non-interactive >/tmp/astroclaw-cleanup-reset.log 2>&1; then
  cat /tmp/astroclaw-cleanup-reset.log
  exit 1
fi

test ! -f "${ASTROCLAW_CONFIG_PATH}"
test ! -d "${ASTROCLAW_STATE_DIR}/credentials"
test ! -d "${ASTROCLAW_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${ASTROCLAW_STATE_DIR}/credentials"
echo '{}' >"${ASTROCLAW_CONFIG_PATH}"

echo "==> Uninstall (state only)"
if ! pnpm astroclaw uninstall --state --yes --non-interactive >/tmp/astroclaw-cleanup-uninstall.log 2>&1; then
  cat /tmp/astroclaw-cleanup-uninstall.log
  exit 1
fi

test ! -d "${ASTROCLAW_STATE_DIR}"

echo "OK"
