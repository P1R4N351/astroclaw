const COMMON_LIVE_ENV_NAMES = [
  "ASTROCLAW_AGENT_RUNTIME",
  "ASTROCLAW_CONFIG_PATH",
  "ASTROCLAW_GATEWAY_TOKEN",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "ASTROCLAW_SKIP_BROWSER_CONTROL_SERVER",
  "ASTROCLAW_SKIP_CANVAS_HOST",
  "ASTROCLAW_SKIP_CHANNELS",
  "ASTROCLAW_SKIP_CRON",
  "ASTROCLAW_SKIP_GMAIL_WATCHER",
  "ASTROCLAW_STATE_DIR",
] as const;

export type LiveEnvSnapshot = Record<string, string | undefined>;

export function snapshotLiveEnv(extraNames: readonly string[] = []): LiveEnvSnapshot {
  const snapshot: LiveEnvSnapshot = {};
  for (const name of [...COMMON_LIVE_ENV_NAMES, ...extraNames]) {
    snapshot[name] = process.env[name];
  }
  return snapshot;
}

export function restoreLiveEnv(snapshot: LiveEnvSnapshot): void {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}
