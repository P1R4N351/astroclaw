// Applies OpenClaw's default fs-safe runtime configuration.
//
// PINNED-DEPENDENCY DIVERGENCE (P-BACKLOG [8a8e8b0]; same fix as a387ac198f0,
// re-clobbered by the p10 rewrite b7930439734). This branch pins
// @openclaw/fs-safe 0.2.4, whose ./config exports only configureFsSafePython /
// getFsSafePythonConfig / configureFsSafeLocks / getFsSafeLockConfig.
// configureFsSafeNative arrived upstream together with the fs-safe 0.5.0 bump
// (openclaw 0d7fb8eb392). Importing it against 0.2.4 yields undefined, and
// calling it threw "configureFsSafeNative is not a function" at import time
// for every consumer of src/utils.ts. Keep the Python spelling here until
// package.json moves to fs-safe >= 0.5.0; do not re-materialize upstream.
import { configureFsSafePython } from "@openclaw/fs-safe/config";
import type { FsSafePythonConfig } from "@openclaw/fs-safe/config";

/**
 * Pinned-0.2.4 adapter for upstream call sites that import
 * configureFsSafeNative from this module (e.g. sealed-runtime-bootstrap.ts).
 * On fs-safe 0.2.4 the Python helper is the only optional helper, so the mode
 * is forwarded to it unchanged.
 */
export function configureFsSafeNative(config: Pick<FsSafePythonConfig, "mode">): void {
  configureFsSafePython({ mode: config.mode });
}

// OpenClaw does not rely on optional helpers for normal filesystem safety. Tests
// and operators can still opt in with fs-safe's documented env override.
const hasModeOverride = Object.keys(process.env).some((key) =>
  /^(?:OPENCLAW_)?FS_SAFE_(?:NATIVE|PYTHON)_MODE$/u.test(
    process.platform === "win32" ? key.toUpperCase() : key,
  ),
);

if (!hasModeOverride) {
  configureFsSafePython({ mode: "off" });
}
