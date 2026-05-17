#!/usr/bin/env bash
# Installs Astroclaw from a prepared package tarball, installs @astroclaw/codex
# from the real npm registry, and verifies a live Codex app-server turn.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker-e2e-image.sh"
source "$ROOT_DIR/scripts/lib/docker-e2e-package.sh"

IMAGE_NAME="$(docker_e2e_resolve_image "astroclaw-codex-npm-plugin-live-e2e" ASTROCLAW_CODEX_NPM_PLUGIN_E2E_IMAGE)"
DOCKER_TARGET="${ASTROCLAW_CODEX_NPM_PLUGIN_DOCKER_TARGET:-bare}"
HOST_BUILD="${ASTROCLAW_CODEX_NPM_PLUGIN_HOST_BUILD:-1}"
PACKAGE_TGZ="${ASTROCLAW_CURRENT_PACKAGE_TGZ:-}"
PROFILE_FILE="${ASTROCLAW_CODEX_NPM_PLUGIN_PROFILE_FILE:-${ASTROCLAW_TESTBOX_PROFILE_FILE:-$HOME/.astroclaw-testbox-live.profile}}"

docker_e2e_build_or_reuse "$IMAGE_NAME" codex-npm-plugin-live "$ROOT_DIR/scripts/e2e/Dockerfile" "$ROOT_DIR" "$DOCKER_TARGET"

prepare_package_tgz() {
  if [ -n "$PACKAGE_TGZ" ]; then
    PACKAGE_TGZ="$(docker_e2e_prepare_package_tgz codex-npm-plugin-live "$PACKAGE_TGZ")"
    return 0
  fi
  if [ "$HOST_BUILD" = "0" ] && [ -z "${ASTROCLAW_CURRENT_PACKAGE_TGZ:-}" ]; then
    echo "ASTROCLAW_CODEX_NPM_PLUGIN_HOST_BUILD=0 requires ASTROCLAW_CURRENT_PACKAGE_TGZ" >&2
    exit 1
  fi
  PACKAGE_TGZ="$(docker_e2e_prepare_package_tgz codex-npm-plugin-live)"
}

prepare_package_tgz

PROFILE_MOUNT=()
PROFILE_STATUS="none"
if [ -f "$PROFILE_FILE" ] && [ -r "$PROFILE_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$PROFILE_FILE"
  set +a
  PROFILE_MOUNT=(-v "$PROFILE_FILE":/home/appuser/.profile:ro)
  PROFILE_STATUS="$PROFILE_FILE"
fi

docker_e2e_package_mount_args "$PACKAGE_TGZ"
run_log="$(docker_e2e_run_log codex-npm-plugin-live)"
ASTROCLAW_TEST_STATE_SCRIPT_B64="$(docker_e2e_test_state_shell_b64 codex-npm-plugin-live empty)"

echo "Running Codex npm plugin live Docker E2E..."
echo "Profile file: $PROFILE_STATUS"
if ! docker_e2e_run_with_harness \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -e ASTROCLAW_CODEX_NPM_PLUGIN_ALLOW_BETA_COMPAT_DIAGNOSTICS="${ASTROCLAW_CODEX_NPM_PLUGIN_ALLOW_BETA_COMPAT_DIAGNOSTICS:-0}" \
  -e ASTROCLAW_CODEX_NPM_PLUGIN_FORCE_UNSAFE_INSTALL="${ASTROCLAW_CODEX_NPM_PLUGIN_FORCE_UNSAFE_INSTALL:-0}" \
  -e ASTROCLAW_CODEX_NPM_PLUGIN_MODEL="${ASTROCLAW_CODEX_NPM_PLUGIN_MODEL:-codex/gpt-5.4}" \
  -e ASTROCLAW_CODEX_NPM_PLUGIN_SPEC="${ASTROCLAW_CODEX_NPM_PLUGIN_SPEC:-npm:@astroclaw/codex}" \
  -e OPENAI_API_KEY \
  -e OPENAI_BASE_URL \
  -e "ASTROCLAW_TEST_STATE_SCRIPT_B64=$ASTROCLAW_TEST_STATE_SCRIPT_B64" \
  "${DOCKER_E2E_PACKAGE_ARGS[@]}" \
  "${PROFILE_MOUNT[@]}" \
  -i "$IMAGE_NAME" bash -s >"$run_log" 2>&1 <<'EOF'; then
set -euo pipefail

source scripts/lib/astroclaw-e2e-instance.sh
astroclaw_e2e_eval_test_state_from_b64 "${ASTROCLAW_TEST_STATE_SCRIPT_B64:?missing ASTROCLAW_TEST_STATE_SCRIPT_B64}"
export NPM_CONFIG_PREFIX="$HOME/.npm-global"
export npm_config_prefix="$NPM_CONFIG_PREFIX"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-$XDG_CACHE_HOME/npm}"
export npm_config_cache="$NPM_CONFIG_CACHE"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
export ASTROCLAW_AGENT_HARNESS_FALLBACK=none

for profile_path in "$HOME/.profile" /home/appuser/.profile; do
  if [ -f "$profile_path" ] && [ -r "$profile_path" ]; then
    set +e +u
    source "$profile_path"
    set -euo pipefail
    break
  fi
done
if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "ERROR: OPENAI_API_KEY was not available after sourcing ~/.profile." >&2
  exit 1
fi
export OPENAI_API_KEY
if [ -n "${OPENAI_BASE_URL:-}" ]; then
  export OPENAI_BASE_URL
fi

CODEX_PLUGIN_SPEC="${ASTROCLAW_CODEX_NPM_PLUGIN_SPEC:?missing ASTROCLAW_CODEX_NPM_PLUGIN_SPEC}"
MODEL_REF="${ASTROCLAW_CODEX_NPM_PLUGIN_MODEL:?missing ASTROCLAW_CODEX_NPM_PLUGIN_MODEL}"
SESSION_ID="codex-npm-plugin-live"
SUCCESS_MARKER="ASTROCLAW-CODEX-NPM-PLUGIN-LIVE-OK"
PLUGIN_INSTALL_FLAGS=(--force)
if [ "${ASTROCLAW_CODEX_NPM_PLUGIN_FORCE_UNSAFE_INSTALL:-0}" = "1" ]; then
  PLUGIN_INSTALL_FLAGS+=(--dangerously-force-unsafe-install)
fi

dump_debug_logs() {
  local status="$1"
  echo "Codex npm plugin live scenario failed with exit code $status" >&2
  astroclaw_e2e_dump_logs \
    /tmp/astroclaw-install.log \
    /tmp/astroclaw-codex-plugin-install.log \
    /tmp/astroclaw-codex-plugin-enable.log \
    /tmp/astroclaw-codex-plugins-list.json \
    /tmp/astroclaw-codex-plugin-inspect.json \
    /tmp/astroclaw-codex-preflight.log \
    /tmp/astroclaw-codex-agent.json \
    /tmp/astroclaw-codex-agent.err \
    /tmp/astroclaw-codex-plugin-uninstall.log \
    /tmp/astroclaw-codex-plugins-list-after-uninstall.json \
    /tmp/astroclaw-codex-agent-after-uninstall.json \
    /tmp/astroclaw-codex-agent-after-uninstall.err
}
trap 'status=$?; dump_debug_logs "$status"; exit "$status"' ERR

mkdir -p "$NPM_CONFIG_PREFIX" "$XDG_CACHE_HOME" "$NPM_CONFIG_CACHE"
chmod 700 "$XDG_CACHE_HOME" "$NPM_CONFIG_CACHE" || true

astroclaw_e2e_install_package /tmp/astroclaw-install.log
command -v astroclaw >/dev/null

echo "Installing Codex plugin from npm: $CODEX_PLUGIN_SPEC"
astroclaw plugins install "$CODEX_PLUGIN_SPEC" "${PLUGIN_INSTALL_FLAGS[@]}" >/tmp/astroclaw-codex-plugin-install.log 2>&1

node scripts/e2e/lib/codex-npm-plugin-live/assertions.mjs configure "$MODEL_REF"

echo "Enabling Codex plugin..."
astroclaw plugins enable codex >/tmp/astroclaw-codex-plugin-enable.log 2>&1

astroclaw plugins list --json >/tmp/astroclaw-codex-plugins-list.json
astroclaw plugins inspect codex --runtime --json >/tmp/astroclaw-codex-plugin-inspect.json
node scripts/e2e/lib/codex-npm-plugin-live/assertions.mjs assert-plugin "$CODEX_PLUGIN_SPEC"
node scripts/e2e/lib/codex-npm-plugin-live/assertions.mjs assert-npm-deps

CODEX_BIN="$(node scripts/e2e/lib/codex-npm-plugin-live/assertions.mjs print-codex-bin)"
printf '%s\n' "$OPENAI_API_KEY" | "$CODEX_BIN" login --with-api-key >/dev/null

echo "Running Codex CLI preflight via managed npm dependency..."
"$CODEX_BIN" exec \
  --json \
  --color never \
  --skip-git-repo-check \
  "Reply exactly: ${SUCCESS_MARKER}-PREFLIGHT" >/tmp/astroclaw-codex-preflight.log 2>&1
node scripts/e2e/lib/codex-npm-plugin-live/assertions.mjs assert-preflight "${SUCCESS_MARKER}-PREFLIGHT"

echo "Running Astroclaw local agent turn through npm-installed Codex plugin..."
astroclaw agent --local \
  --agent main \
  --session-id "$SESSION_ID" \
  --model "$MODEL_REF" \
  --message "Reply exactly: $SUCCESS_MARKER" \
  --thinking low \
  --timeout 420 \
  --json >/tmp/astroclaw-codex-agent.json 2>/tmp/astroclaw-codex-agent.err

node scripts/e2e/lib/codex-npm-plugin-live/assertions.mjs assert-agent-turn "$SUCCESS_MARKER" "$SESSION_ID" "$MODEL_REF"

echo "Uninstalling Codex plugin and verifying the configured harness now fails..."
astroclaw plugins uninstall codex --force >/tmp/astroclaw-codex-plugin-uninstall.log 2>&1
astroclaw plugins list --json >/tmp/astroclaw-codex-plugins-list-after-uninstall.json
node scripts/e2e/lib/codex-npm-plugin-live/assertions.mjs assert-uninstalled

set +e
astroclaw agent --local \
  --agent main \
  --session-id "${SESSION_ID}-after-uninstall" \
  --model "$MODEL_REF" \
  --message "Reply exactly: ${SUCCESS_MARKER}-AFTER-UNINSTALL" \
  --thinking low \
  --timeout 120 \
  --json >/tmp/astroclaw-codex-agent-after-uninstall.json 2>/tmp/astroclaw-codex-agent-after-uninstall.err
after_uninstall_status=$?
set -e
node scripts/e2e/lib/codex-npm-plugin-live/assertions.mjs assert-agent-error "$after_uninstall_status"

echo "Codex npm plugin live Docker E2E passed"
EOF
  docker_e2e_print_log "$run_log"
  rm -f "$run_log"
  exit 1
fi

rm -f "$run_log"
echo "Codex npm plugin live Docker E2E passed"
