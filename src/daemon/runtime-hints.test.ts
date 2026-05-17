import { describe, expect, it } from "vitest";
import { buildPlatformRuntimeLogHints, buildPlatformServiceStartHints } from "./runtime-hints.js";

describe("buildPlatformRuntimeLogHints", () => {
  it("renders launchd log hints on darwin", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "darwin",
        env: {
          ASTROCLAW_STATE_DIR: "/tmp/astroclaw-state",
          ASTROCLAW_LOG_PREFIX: "gateway",
        },
        systemdServiceName: "astroclaw-gateway",
        windowsTaskName: "Astroclaw Gateway",
      }),
    ).toEqual([
      "Launchd stdout (if installed): /tmp/astroclaw-state/logs/gateway.log",
      "Launchd stderr (if installed): suppressed",
      "Restart attempts: /tmp/astroclaw-state/logs/gateway-restart.log",
    ]);
  });

  it("renders systemd and windows hints by platform", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "linux",
        env: {
          ASTROCLAW_STATE_DIR: "/tmp/astroclaw-state",
        },
        systemdServiceName: "astroclaw-gateway",
        windowsTaskName: "Astroclaw Gateway",
      }),
    ).toEqual([
      "Logs: journalctl --user -u astroclaw-gateway.service -n 200 --no-pager",
      "Restart attempts: /tmp/astroclaw-state/logs/gateway-restart.log",
    ]);
    expect(
      buildPlatformRuntimeLogHints({
        platform: "win32",
        env: {
          ASTROCLAW_STATE_DIR: "/tmp/astroclaw-state",
        },
        systemdServiceName: "astroclaw-gateway",
        windowsTaskName: "Astroclaw Gateway",
      }),
    ).toEqual([
      'Logs: schtasks /Query /TN "Astroclaw Gateway" /V /FO LIST',
      "Restart attempts: /tmp/astroclaw-state/logs/gateway-restart.log",
    ]);
  });
});

describe("buildPlatformServiceStartHints", () => {
  it("builds platform-specific service start hints", () => {
    expect(
      buildPlatformServiceStartHints({
        platform: "darwin",
        installCommand: "astroclaw gateway install",
        startCommand: "astroclaw gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.astroclaw.gateway.plist",
        systemdServiceName: "astroclaw-gateway",
        windowsTaskName: "Astroclaw Gateway",
      }),
    ).toEqual([
      "astroclaw gateway install",
      "astroclaw gateway",
      "launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.astroclaw.gateway.plist",
    ]);
    expect(
      buildPlatformServiceStartHints({
        platform: "linux",
        installCommand: "astroclaw gateway install",
        startCommand: "astroclaw gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.astroclaw.gateway.plist",
        systemdServiceName: "astroclaw-gateway",
        windowsTaskName: "Astroclaw Gateway",
      }),
    ).toEqual([
      "astroclaw gateway install",
      "astroclaw gateway",
      "systemctl --user start astroclaw-gateway.service",
    ]);
  });
});
