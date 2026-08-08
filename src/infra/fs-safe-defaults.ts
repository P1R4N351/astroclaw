// Applies OpenClaw's default fs-safe runtime configuration.
import { configureFsSafePython } from "@openclaw/fs-safe/config";

// OpenClaw does not rely on Python helpers for normal filesystem safety. Tests
// and operators can still opt in with fs-safe's documented env override.
const hasModeOverride = Object.keys(process.env).some((key) =>
  /^(?:OPENCLAW_)?FS_SAFE_(?:NATIVE|PYTHON)_MODE$/u.test(
    process.platform === "win32" ? key.toUpperCase() : key,
  ),
);

if (!hasModeOverride) {
  configureFsSafePython({ mode: "off" });
}
