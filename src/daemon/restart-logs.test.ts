import { describe, expect, it } from "vitest";
import {
  GATEWAY_RESTART_LOG_FILENAME,
  renderCmdRestartLogSetup,
  renderPosixRestartLogSetup,
  resolveGatewayLogPaths,
  resolveGatewayRestartLogPath,
} from "./restart-logs.js";

describe("restart log conventions", () => {
  it("resolves profile-aware gateway logs and restart attempts together", () => {
    const env = {
      HOME: "/Users/test",
      ASTROCLAW_PROFILE: "work",
    };

    expect(resolveGatewayLogPaths(env)).toEqual({
      logDir: "/Users/test/.astroclaw-work/logs",
      stdoutPath: "/Users/test/.astroclaw-work/logs/gateway.log",
      stderrPath: "/Users/test/.astroclaw-work/logs/gateway.err.log",
    });
    expect(resolveGatewayRestartLogPath(env)).toBe(
      `/Users/test/.astroclaw-work/logs/${GATEWAY_RESTART_LOG_FILENAME}`,
    );
  });

  it("honors ASTROCLAW_STATE_DIR for restart attempts", () => {
    const env = {
      HOME: "/Users/test",
      ASTROCLAW_STATE_DIR: "/tmp/astroclaw-state",
    };

    expect(resolveGatewayRestartLogPath(env)).toBe(
      `/tmp/astroclaw-state/logs/${GATEWAY_RESTART_LOG_FILENAME}`,
    );
  });

  it("renders best-effort POSIX log setup with escaped paths", () => {
    const setup = renderPosixRestartLogSetup({
      HOME: "/Users/test's",
    });

    expect(setup).toContain(
      "if mkdir -p '/Users/test'\\''s/.astroclaw/logs' 2>/dev/null && : >>'/Users/test'\\''s/.astroclaw/logs/gateway-restart.log' 2>/dev/null; then",
    );
    expect(setup).toContain("exec >>'/Users/test'\\''s/.astroclaw/logs/gateway-restart.log' 2>&1");
  });

  it("renders CMD log setup with quoted paths", () => {
    const setup = renderCmdRestartLogSetup({
      USERPROFILE: "C:\\Users\\Test User",
    });

    expect(setup.quotedLogPath).toBe('"C:\\Users\\Test User/.astroclaw/logs/gateway-restart.log"');
    expect(setup.lines).toContain(
      'if not exist "C:\\Users\\Test User/.astroclaw/logs" mkdir "C:\\Users\\Test User/.astroclaw/logs" >nul 2>&1',
    );
  });
});
