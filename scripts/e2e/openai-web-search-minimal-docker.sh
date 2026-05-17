#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker-e2e-image.sh"

IMAGE_NAME="$(docker_e2e_resolve_image "astroclaw-openai-web-search-minimal-e2e" ASTROCLAW_OPENAI_WEB_SEARCH_MINIMAL_E2E_IMAGE)"
SKIP_BUILD="${ASTROCLAW_OPENAI_WEB_SEARCH_MINIMAL_E2E_SKIP_BUILD:-0}"
PORT="18789"
MOCK_PORT="80"
TOKEN="openai-web-search-minimal-e2e-$$"

docker_e2e_build_or_reuse "$IMAGE_NAME" openai-web-search-minimal "$ROOT_DIR/scripts/e2e/Dockerfile" "$ROOT_DIR" "" "$SKIP_BUILD"
ASTROCLAW_TEST_STATE_SCRIPT_B64="$(docker_e2e_test_state_shell_b64 openai-web-search-minimal empty)"

echo "Running OpenAI web_search minimal reasoning Docker E2E..."
docker_e2e_run_logged_with_harness openai-web-search-minimal \
  --add-host api.openai.com:127.0.0.1 \
  -e "ASTROCLAW_GATEWAY_TOKEN=$TOKEN" \
  -e "OPENAI_API_KEY=sk-astroclaw-web-search-minimal-e2e" \
  -e "ASTROCLAW_TEST_STATE_SCRIPT_B64=$ASTROCLAW_TEST_STATE_SCRIPT_B64" \
  -e "PORT=$PORT" \
  -e "MOCK_PORT=$MOCK_PORT" \
  "$IMAGE_NAME" \
  bash scripts/e2e/lib/openai-web-search-minimal/scenario.sh
