#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker-e2e-image.sh"

IMAGE_NAME="$(docker_e2e_resolve_image "astroclaw-npm-telegram-rtt-e2e" ASTROCLAW_NPM_TELEGRAM_RTT_E2E_IMAGE)"
DOCKER_TARGET="${ASTROCLAW_NPM_TELEGRAM_DOCKER_TARGET:-build}"
PACKAGE_SPEC="${ASTROCLAW_NPM_TELEGRAM_PACKAGE_SPEC:-astroclaw@beta}"
PACKAGE_TGZ="${ASTROCLAW_NPM_TELEGRAM_PACKAGE_TGZ:-${ASTROCLAW_CURRENT_PACKAGE_TGZ:-}}"
PACKAGE_LABEL="${ASTROCLAW_NPM_TELEGRAM_PACKAGE_LABEL:-}"
OUTPUT_DIR="${ASTROCLAW_NPM_TELEGRAM_OUTPUT_DIR:-.artifacts/qa-e2e/npm-telegram-rtt}"

resolve_credential_source() {
  if [ -n "${ASTROCLAW_NPM_TELEGRAM_CREDENTIAL_SOURCE:-}" ]; then
    printf "%s" "$ASTROCLAW_NPM_TELEGRAM_CREDENTIAL_SOURCE"
    return 0
  fi
  if [ -n "${ASTROCLAW_QA_CREDENTIAL_SOURCE:-}" ]; then
    printf "%s" "$ASTROCLAW_QA_CREDENTIAL_SOURCE"
    return 0
  fi
  if [ -n "${CI:-}" ] && [ -n "${ASTROCLAW_QA_CONVEX_SITE_URL:-}" ]; then
    if [ -n "${ASTROCLAW_QA_CONVEX_SECRET_CI:-}" ] || [ -n "${ASTROCLAW_QA_CONVEX_SECRET_MAINTAINER:-}" ]; then
      printf "convex"
    fi
  fi
}

resolve_credential_role() {
  if [ -n "${ASTROCLAW_NPM_TELEGRAM_CREDENTIAL_ROLE:-}" ]; then
    printf "%s" "$ASTROCLAW_NPM_TELEGRAM_CREDENTIAL_ROLE"
    return 0
  fi
  if [ -n "${ASTROCLAW_QA_CREDENTIAL_ROLE:-}" ]; then
    printf "%s" "$ASTROCLAW_QA_CREDENTIAL_ROLE"
  fi
}

validate_astroclaw_package_spec() {
  local spec="$1"
  if [[ "$spec" =~ ^astroclaw@(main|alpha|beta|latest|[0-9]{4}\.[1-9][0-9]*\.[1-9][0-9]*(-[1-9][0-9]*|-(alpha|beta)\.[1-9][0-9]*)?)$ ]]; then
    return 0
  fi
  echo "ASTROCLAW_NPM_TELEGRAM_PACKAGE_SPEC must be astroclaw@main, astroclaw@alpha, astroclaw@beta, astroclaw@latest, or an exact Astroclaw release version; got: $spec" >&2
  exit 1
}

resolve_package_tgz() {
  local candidate="$1"
  if [ -z "$candidate" ]; then
    return 0
  fi
  if [ ! -f "$candidate" ]; then
    echo "ASTROCLAW_NPM_TELEGRAM_PACKAGE_TGZ must point to an existing .tgz file; got: $candidate" >&2
    exit 1
  fi
  case "$candidate" in
    *.tgz) ;;
    *)
      echo "ASTROCLAW_NPM_TELEGRAM_PACKAGE_TGZ must point to a .tgz file; got: $candidate" >&2
      exit 1
      ;;
  esac
  local dir
  local base
  dir="$(cd "$(dirname "$candidate")" && pwd)"
  base="$(basename "$candidate")"
  printf "%s/%s" "$dir" "$base"
}

package_mount_args=()
package_install_source="$PACKAGE_SPEC"
resolved_package_tgz="$(resolve_package_tgz "$PACKAGE_TGZ")"
if [ -n "$resolved_package_tgz" ]; then
  package_install_source="/package-under-test/$(basename "$resolved_package_tgz")"
  package_mount_args=(-v "$resolved_package_tgz:$package_install_source:ro")
else
  validate_astroclaw_package_spec "$PACKAGE_SPEC"
fi
if [ -z "$PACKAGE_LABEL" ]; then
  if [ -n "$resolved_package_tgz" ]; then
    PACKAGE_LABEL="$(basename "$resolved_package_tgz")"
  else
    PACKAGE_LABEL="$PACKAGE_SPEC"
  fi
fi

credential_source="$(resolve_credential_source)"
credential_role="$(resolve_credential_role)"
if [ -z "$credential_role" ] && [ "$credential_source" = "convex" ]; then
  if [ -n "${CI:-}" ]; then
    credential_role="ci"
  else
    credential_role="maintainer"
  fi
fi

validate_credential_source() {
  case "$credential_source" in
    "" | env | convex) ;;
    *)
      echo "ASTROCLAW_NPM_TELEGRAM_CREDENTIAL_SOURCE must be env or convex; got: $credential_source" >&2
      exit 1
      ;;
  esac
}

validate_credential_role() {
  case "$credential_role" in
    "" | maintainer | ci) ;;
    *)
      echo "ASTROCLAW_NPM_TELEGRAM_CREDENTIAL_ROLE must be maintainer or ci; got: $credential_role" >&2
      exit 1
      ;;
  esac
}

validate_credential_source
validate_credential_role

validate_credential_preflight() {
  if [ "$credential_source" = "convex" ]; then
    if [ -z "${ASTROCLAW_QA_CONVEX_SITE_URL:-}" ]; then
      echo "Missing required env for Convex credential mode: ASTROCLAW_QA_CONVEX_SITE_URL" >&2
      exit 1
    fi
    if [ "$credential_role" = "ci" ]; then
      if [ -z "${ASTROCLAW_QA_CONVEX_SECRET_CI:-}" ]; then
        echo "Missing required env for Convex ci credential mode: ASTROCLAW_QA_CONVEX_SECRET_CI" >&2
        exit 1
      fi
      return 0
    fi
    if [ "$credential_role" = "maintainer" ]; then
      if [ -z "${ASTROCLAW_QA_CONVEX_SECRET_MAINTAINER:-}" ]; then
        echo "Missing required env for Convex maintainer credential mode: ASTROCLAW_QA_CONVEX_SECRET_MAINTAINER" >&2
        exit 1
      fi
      return 0
    fi
    if [ -z "${ASTROCLAW_QA_CONVEX_SECRET_CI:-}" ] && [ -z "${ASTROCLAW_QA_CONVEX_SECRET_MAINTAINER:-}" ]; then
      echo "Missing required env for Convex credential mode: ASTROCLAW_QA_CONVEX_SECRET_CI or ASTROCLAW_QA_CONVEX_SECRET_MAINTAINER" >&2
      exit 1
    fi
    return 0
  fi

  for key in \
    ASTROCLAW_QA_TELEGRAM_GROUP_ID \
    ASTROCLAW_QA_TELEGRAM_DRIVER_BOT_TOKEN \
    ASTROCLAW_QA_TELEGRAM_SUT_BOT_TOKEN; do
    if [ -z "${!key:-}" ]; then
      echo "Missing required env: $key" >&2
      exit 1
    fi
  done
}

validate_credential_preflight

if [ -n "$credential_source" ]; then
  export ASTROCLAW_QA_CREDENTIAL_SOURCE="$credential_source"
fi
if [ -n "$credential_role" ]; then
  export ASTROCLAW_QA_CREDENTIAL_ROLE="$credential_role"
fi

if [ -z "$credential_source" ] || [ "$credential_source" = "env" ]; then
  for key in \
    ASTROCLAW_QA_TELEGRAM_GROUP_ID \
    ASTROCLAW_QA_TELEGRAM_DRIVER_BOT_TOKEN \
    ASTROCLAW_QA_TELEGRAM_SUT_BOT_TOKEN; do
    if [ -z "${!key:-}" ]; then
      echo "Missing required env: $key" >&2
      exit 1
    fi
  done
fi

for value in "$credential_source" "$credential_role"; do
  if [[ "$value" == *[$'\n\r']* ]]; then
    echo "Credential source and role must be single-line values." >&2
    exit 1
  fi
done

docker_e2e_build_or_reuse "$IMAGE_NAME" npm-telegram-rtt "$ROOT_DIR/scripts/e2e/Dockerfile" "$ROOT_DIR" "$DOCKER_TARGET"

mkdir -p "$ROOT_DIR/.artifacts/qa-e2e"
run_log="$(mktemp "${TMPDIR:-/tmp}/astroclaw-npm-telegram-rtt.XXXXXX")"
npm_prefix_host="$(mktemp -d "$ROOT_DIR/.artifacts/qa-e2e/npm-telegram-rtt-prefix.XXXXXX")"
trap 'rm -f "$run_log"; rm -rf "$npm_prefix_host"' EXIT

docker_env=(
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  -e ASTROCLAW_NPM_TELEGRAM_INSTALL_SOURCE="$package_install_source"
  -e ASTROCLAW_NPM_TELEGRAM_PACKAGE_LABEL="$PACKAGE_LABEL"
  -e ASTROCLAW_NPM_TELEGRAM_OUTPUT_DIR="$OUTPUT_DIR"
  -e ASTROCLAW_QA_TELEGRAM_GROUP_ID
  -e ASTROCLAW_QA_TELEGRAM_DRIVER_BOT_TOKEN
  -e ASTROCLAW_QA_TELEGRAM_SUT_BOT_TOKEN
  -e ASTROCLAW_QA_TELEGRAM_CANARY_TIMEOUT_MS="${ASTROCLAW_QA_TELEGRAM_CANARY_TIMEOUT_MS:-180000}"
  -e ASTROCLAW_QA_TELEGRAM_SCENARIO_TIMEOUT_MS="${ASTROCLAW_QA_TELEGRAM_SCENARIO_TIMEOUT_MS:-180000}"
  -e ASTROCLAW_NPM_TELEGRAM_SCENARIOS="${ASTROCLAW_NPM_TELEGRAM_SCENARIOS:-telegram-mentioned-message-reply}"
  -e ASTROCLAW_NPM_TELEGRAM_PROVIDER_MODE="${ASTROCLAW_NPM_TELEGRAM_PROVIDER_MODE:-mock-openai}"
  -e ASTROCLAW_NPM_TELEGRAM_WARM_SAMPLES="${ASTROCLAW_NPM_TELEGRAM_WARM_SAMPLES:-20}"
  -e ASTROCLAW_NPM_TELEGRAM_SAMPLE_TIMEOUT_MS="${ASTROCLAW_NPM_TELEGRAM_SAMPLE_TIMEOUT_MS:-30000}"
  -e ASTROCLAW_NPM_TELEGRAM_MAX_FAILURES="${ASTROCLAW_NPM_TELEGRAM_MAX_FAILURES:-${ASTROCLAW_NPM_TELEGRAM_WARM_SAMPLES:-20}}"
)

forward_env_if_set() {
  local key="$1"
  if [ -n "${!key:-}" ]; then
    docker_env+=(-e "$key")
  fi
}

if [ -n "${ASTROCLAW_QA_CREDENTIAL_SOURCE:-}" ]; then
  docker_env+=(-e ASTROCLAW_QA_CREDENTIAL_SOURCE="$ASTROCLAW_QA_CREDENTIAL_SOURCE")
fi
if [ -n "${ASTROCLAW_QA_CREDENTIAL_ROLE:-}" ]; then
  docker_env+=(-e ASTROCLAW_QA_CREDENTIAL_ROLE="$ASTROCLAW_QA_CREDENTIAL_ROLE")
fi

install_env=("${docker_env[@]}")

for key in \
  ASTROCLAW_QA_CONVEX_SITE_URL \
  ASTROCLAW_QA_CONVEX_SECRET_CI \
  ASTROCLAW_QA_CONVEX_SECRET_MAINTAINER \
  ASTROCLAW_QA_CREDENTIAL_LEASE_TTL_MS \
  ASTROCLAW_QA_CREDENTIAL_HEARTBEAT_INTERVAL_MS \
  ASTROCLAW_QA_CREDENTIAL_ACQUIRE_TIMEOUT_MS \
  ASTROCLAW_QA_CREDENTIAL_HTTP_TIMEOUT_MS \
  ASTROCLAW_QA_CONVEX_ENDPOINT_PREFIX \
  ASTROCLAW_QA_CREDENTIAL_OWNER_ID \
  ASTROCLAW_QA_ALLOW_INSECURE_HTTP; do
  forward_env_if_set "$key"
done

run_logged() {
  if ! "$@" >"$run_log" 2>&1; then
    cat "$run_log"
    exit 1
  fi
  cat "$run_log"
  >"$run_log"
}

echo "Installing ${PACKAGE_LABEL} from ${package_install_source}..."
run_logged docker run --rm \
  "${install_env[@]}" \
  ${package_mount_args[@]+"${package_mount_args[@]}"} \
  -v "$npm_prefix_host:/npm-global" \
  -i "$IMAGE_NAME" bash -s <<'EOF'
set -euo pipefail

export NPM_CONFIG_PREFIX="/npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"

install_source="${ASTROCLAW_NPM_TELEGRAM_INSTALL_SOURCE:?missing ASTROCLAW_NPM_TELEGRAM_INSTALL_SOURCE}"
package_label="${ASTROCLAW_NPM_TELEGRAM_PACKAGE_LABEL:-$install_source}"

npm install -g "$install_source" --no-fund --no-audit
command -v astroclaw
astroclaw --version
node -p "require('/npm-global/lib/node_modules/astroclaw/package.json').version"
EOF

echo "Running package Telegram RTT Docker E2E ($PACKAGE_LABEL)..."
run_logged docker run --rm \
  "${docker_env[@]}" \
  -v "$ROOT_DIR/scripts:/app/scripts:ro" \
  -v "$ROOT_DIR/.artifacts:/app/.artifacts" \
  -v "$npm_prefix_host:/npm-global" \
  -i "$IMAGE_NAME" bash -s <<'EOF'
set -euo pipefail

export HOME="$(mktemp -d "/tmp/astroclaw-npm-telegram-rtt.XXXXXX")"
export NPM_CONFIG_PREFIX="/npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
export OPENAI_API_KEY="sk-astroclaw-rtt"
export GATEWAY_AUTH_TOKEN_REF="astroclaw-rtt"
export ASTROCLAW_DISABLE_BONJOUR="1"

install_source="${ASTROCLAW_NPM_TELEGRAM_INSTALL_SOURCE:?missing ASTROCLAW_NPM_TELEGRAM_INSTALL_SOURCE}"
package_label="${ASTROCLAW_NPM_TELEGRAM_PACKAGE_LABEL:-$install_source}"
mock_port="${ASTROCLAW_NPM_TELEGRAM_MOCK_PORT:-44080}"
config_path="$HOME/.astroclaw/astroclaw.json"
gateway_log="/tmp/astroclaw-npm-telegram-rtt-gateway.log"
mock_log="/tmp/astroclaw-npm-telegram-rtt-mock.log"
export MOCK_PORT="$mock_port"
credential_env_file=""
credential_lease_file=""
credential_heartbeat_pid=""
rtt_shell_pid="$$"

dump_logs() {
  local status="$1"
  if [ "$status" -eq 0 ]; then
    return
  fi
  echo "package Telegram RTT failed with exit code $status" >&2
  for file in \
    "$mock_log" \
    "$gateway_log"; do
    if [ -f "$file" ]; then
      echo "--- $file ---" >&2
      sed -n '1,260p' "$file" >&2 || true
    fi
  done
}

cleanup() {
  local status="$?"
  kill ${gateway_pid:-} ${mock_pid:-} ${credential_heartbeat_pid:-} 2>/dev/null || true
  if [ -n "$credential_lease_file" ] && [ -f "$credential_lease_file" ]; then
    node /app/scripts/e2e/npm-telegram-rtt-credentials.mjs release --lease-file "$credential_lease_file" >/dev/null 2>&1 || true
  fi
  rm -f "$credential_env_file" "$credential_lease_file"
  dump_logs "$status"
  exit "$status"
}

start_credential_heartbeat() {
  (
    set +e
    node /app/scripts/e2e/npm-telegram-rtt-credentials.mjs heartbeat --lease-file "$credential_lease_file" &
    local heartbeat_child_pid="$!"
    trap 'kill "$heartbeat_child_pid" 2>/dev/null || true; wait "$heartbeat_child_pid" 2>/dev/null || true; exit 0' TERM INT
    wait "$heartbeat_child_pid"
    local heartbeat_status="$?"
    echo "Convex credential heartbeat exited with status $heartbeat_status" >&2
    kill -TERM "$rtt_shell_pid" 2>/dev/null || true
    exit "$heartbeat_status"
  ) &
  credential_heartbeat_pid="$!"
}

trap cleanup EXIT
trap 'exit 1' TERM INT

if [ "${ASTROCLAW_QA_CREDENTIAL_SOURCE:-}" = "convex" ]; then
  credential_env_file="$(mktemp "/tmp/astroclaw-npm-telegram-rtt-credential-env.XXXXXX")"
  credential_lease_file="$(mktemp "/tmp/astroclaw-npm-telegram-rtt-credential-lease.XXXXXX")"
  rm -f "$credential_env_file" "$credential_lease_file"
  node /app/scripts/e2e/npm-telegram-rtt-credentials.mjs acquire \
    --credential-env-file "$credential_env_file" \
    --lease-file "$credential_lease_file"
  # shellcheck source=/dev/null
  source "$credential_env_file"
  start_credential_heartbeat
fi

export TELEGRAM_BOT_TOKEN="${ASTROCLAW_QA_TELEGRAM_SUT_BOT_TOKEN:?missing ASTROCLAW_QA_TELEGRAM_SUT_BOT_TOKEN}"

command -v astroclaw
astroclaw --version
installed_version="$(node -p "require('/npm-global/lib/node_modules/astroclaw/package.json').version")"

node /app/scripts/e2e/mock-openai-server.mjs >"$mock_log" 2>&1 &
mock_pid="$!"
for _ in $(seq 1 60); do
  if node -e "fetch('http://127.0.0.1:${mock_port}/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    break
  fi
  sleep 1
done

mkdir -p "$(dirname "$config_path")" "$HOME/.astroclaw/workspace" "$HOME/.astroclaw/agents/main/sessions" "$HOME/workspace"

node /app/scripts/e2e/npm-telegram-rtt-config.mjs \
  "$config_path" \
  "$mock_port" \
  "$ASTROCLAW_QA_TELEGRAM_GROUP_ID" \
  "$ASTROCLAW_QA_TELEGRAM_DRIVER_BOT_TOKEN" \
  "$ASTROCLAW_QA_TELEGRAM_SUT_BOT_TOKEN" \
  "$installed_version"

astroclaw gateway run --verbose >"$gateway_log" 2>&1 &
gateway_pid="$!"
for _ in $(seq 1 120); do
  if ! kill -0 "$gateway_pid" 2>/dev/null; then
    echo "gateway exited before readiness" >&2
    exit 1
  fi
  if bash -c ":</dev/tcp/127.0.0.1/18789" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! bash -c ":</dev/tcp/127.0.0.1/18789" >/dev/null 2>&1; then
  echo "gateway did not open port 18789" >&2
  exit 1
fi

node /app/scripts/e2e/npm-telegram-rtt-driver.mjs
EOF

echo "package Telegram RTT Docker E2E passed ($PACKAGE_LABEL)"
