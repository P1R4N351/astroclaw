run_plugins_clawhub_scenario() {
  if [ "${ASTROCLAW_PLUGINS_E2E_CLAWHUB:-1}" = "0" ]; then
    echo "Skipping ClawHub plugin install and uninstall (ASTROCLAW_PLUGINS_E2E_CLAWHUB=0)."
  else
    echo "Testing ClawHub plugin install and uninstall..."
    CLAWHUB_PLUGIN_SPEC="${ASTROCLAW_PLUGINS_E2E_CLAWHUB_SPEC:-clawhub:@astroclaw/kitchen-sink}"
    CLAWHUB_PLUGIN_ID="${ASTROCLAW_PLUGINS_E2E_CLAWHUB_ID:-astroclaw-kitchen-sink-fixture}"
    export CLAWHUB_PLUGIN_SPEC CLAWHUB_PLUGIN_ID

    start_clawhub_fixture_server() {
      local fixture_dir="$1"
      local server_log="$fixture_dir/clawhub-fixture.log"
      local server_port_file="$fixture_dir/clawhub-fixture-port"
      local server_pid_file="$fixture_dir/clawhub-fixture-pid"

      node scripts/e2e/lib/clawhub-fixture-server.cjs plugins "$server_port_file" >"$server_log" 2>&1 &
      local server_pid="$!"
      echo "$server_pid" >"$server_pid_file"

      for _ in $(seq 1 100); do
        if [[ -s "$server_port_file" ]]; then
          export ASTROCLAW_CLAWHUB_URL="http://127.0.0.1:$(cat "$server_port_file")"
          trap 'if [[ -f "'"$server_pid_file"'" ]]; then kill "$(cat "'"$server_pid_file"'")" 2>/dev/null || true; fi' EXIT
          return 0
        fi
        if ! kill -0 "$server_pid" 2>/dev/null; then
          cat "$server_log"
          return 1
        fi
        sleep 0.1
      done

      cat "$server_log"
      echo "Timed out waiting for ClawHub fixture server." >&2
      return 1
    }

    if [[ "${ASTROCLAW_PLUGINS_E2E_LIVE_CLAWHUB:-0}" = "1" ]]; then
      export ASTROCLAW_CLAWHUB_URL="${ASTROCLAW_CLAWHUB_URL:-${CLAWHUB_URL:-https://clawhub.ai}}"
      export NPM_CONFIG_REGISTRY="${ASTROCLAW_PLUGINS_E2E_LIVE_NPM_REGISTRY:-https://registry.npmjs.org/}"
    else
      # Keep the release-path smoke hermetic; live ClawHub can rate-limit CI.
      if [[ -n "${ASTROCLAW_CLAWHUB_URL:-}" || -n "${CLAWHUB_URL:-}" ]]; then
        echo "Ignoring ambient ClawHub URL for fixture-mode plugin E2E; set ASTROCLAW_PLUGINS_E2E_LIVE_CLAWHUB=1 for live ClawHub."
      fi
      unset ASTROCLAW_CLAWHUB_URL CLAWHUB_URL
      clawhub_fixture_dir="$(mktemp -d "/tmp/astroclaw-clawhub-fixture.XXXXXX")"
      start_clawhub_fixture_server "$clawhub_fixture_dir"
    fi

    node scripts/e2e/lib/plugins/assertions.mjs clawhub-preflight

    run_logged install-clawhub node "$ASTROCLAW_ENTRY" plugins install "$CLAWHUB_PLUGIN_SPEC"
    node "$ASTROCLAW_ENTRY" plugins list --json >/tmp/plugins-clawhub-installed.json
    node "$ASTROCLAW_ENTRY" plugins inspect "$CLAWHUB_PLUGIN_ID" --json >/tmp/plugins-clawhub-inspect.json

    node scripts/e2e/lib/plugins/assertions.mjs clawhub-installed

    node "$ASTROCLAW_ENTRY" plugins update "$CLAWHUB_PLUGIN_ID" >/tmp/plugins-clawhub-update.log 2>&1
    node "$ASTROCLAW_ENTRY" plugins list --json >/tmp/plugins-clawhub-updated.json
    node "$ASTROCLAW_ENTRY" plugins inspect "$CLAWHUB_PLUGIN_ID" --json >/tmp/plugins-clawhub-updated-inspect.json

    node scripts/e2e/lib/plugins/assertions.mjs clawhub-updated

    run_logged uninstall-clawhub node "$ASTROCLAW_ENTRY" plugins uninstall "$CLAWHUB_PLUGIN_SPEC" --force
    node "$ASTROCLAW_ENTRY" plugins list --json >/tmp/plugins-clawhub-uninstalled.json

    node scripts/e2e/lib/plugins/assertions.mjs clawhub-removed
  fi
}
