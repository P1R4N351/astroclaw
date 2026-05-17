run_plugins_marketplace_scenario() {
  echo "Testing marketplace install and update flows..."
  marketplace_root="$HOME/.claude/plugins/marketplaces/fixture-marketplace"
  mkdir -p "$HOME/.claude/plugins" "$marketplace_root/.claude-plugin"
  write_fixture_plugin \
    "$marketplace_root/plugins/marketplace-shortcut" \
    "marketplace-shortcut" \
    "0.0.1" \
    "demo.marketplace.shortcut.v1" \
    "Marketplace Shortcut"
  write_fixture_plugin \
    "$marketplace_root/plugins/marketplace-direct" \
    "marketplace-direct" \
    "0.0.1" \
    "demo.marketplace.direct.v1" \
    "Marketplace Direct"
  node scripts/e2e/lib/fixture.mjs marketplace "$marketplace_root"

  node "$ASTROCLAW_ENTRY" plugins marketplace list claude-fixtures --json >/tmp/marketplace-list.json

  node scripts/e2e/lib/plugins/assertions.mjs marketplace-list

  run_logged install-marketplace-shortcut node "$ASTROCLAW_ENTRY" plugins install marketplace-shortcut@claude-fixtures
  run_logged install-marketplace-direct node "$ASTROCLAW_ENTRY" plugins install marketplace-direct --marketplace claude-fixtures
  node "$ASTROCLAW_ENTRY" plugins list --json >/tmp/plugins-marketplace.json
  node "$ASTROCLAW_ENTRY" plugins inspect marketplace-shortcut --runtime --json >/tmp/plugins-marketplace-shortcut-inspect.json
  node "$ASTROCLAW_ENTRY" plugins inspect marketplace-direct --runtime --json >/tmp/plugins-marketplace-direct-inspect.json

  node scripts/e2e/lib/plugins/assertions.mjs marketplace-installed

  node scripts/e2e/lib/plugins/assertions.mjs marketplace-records

  write_fixture_plugin \
    "$marketplace_root/plugins/marketplace-shortcut" \
    "marketplace-shortcut" \
    "0.0.2" \
    "demo.marketplace.shortcut.v2" \
    "Marketplace Shortcut"
  run_logged update-marketplace-shortcut-dry-run node "$ASTROCLAW_ENTRY" plugins update marketplace-shortcut --dry-run
  run_logged update-marketplace-shortcut node "$ASTROCLAW_ENTRY" plugins update marketplace-shortcut
  node "$ASTROCLAW_ENTRY" plugins list --json >/tmp/plugins-marketplace-updated.json
  node "$ASTROCLAW_ENTRY" plugins inspect marketplace-shortcut --runtime --json >/tmp/plugins-marketplace-updated-inspect.json

  node scripts/e2e/lib/plugins/assertions.mjs marketplace-updated
}
