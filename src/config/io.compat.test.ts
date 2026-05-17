import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { normalizeCompatibilityConfigValues } from "../commands/doctor-legacy-config.js";
import { VERSION } from "../version.js";
import { createConfigIO } from "./io.js";
import { normalizeExecSafeBinProfilesInConfig } from "./normalize-exec-safe-bin.js";
import type { AstroclawConfig } from "./types.astroclaw.js";

async function withTempHome(run: (home: string) => Promise<void>): Promise<void> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "astroclaw-config-"));
  try {
    await run(home);
  } finally {
    await fs.rm(home, { recursive: true, force: true });
  }
}

async function writeConfig(
  home: string,
  dirname: ".astroclaw",
  port: number,
  filename: string = "astroclaw.json",
) {
  const dir = path.join(home, dirname);
  await fs.mkdir(dir, { recursive: true });
  const configPath = path.join(dir, filename);
  await fs.writeFile(configPath, JSON.stringify({ gateway: { port } }, null, 2));
  return configPath;
}

function createIoForHome(home: string, env: NodeJS.ProcessEnv = {} as NodeJS.ProcessEnv) {
  return createConfigIO({
    env,
    homedir: () => home,
  });
}

describe("config io paths", () => {
  it("uses ~/.astroclaw/astroclaw.json when config exists", async () => {
    await withTempHome(async (home) => {
      const configPath = await writeConfig(home, ".astroclaw", 19001);
      const io = createIoForHome(home);
      expect(io.configPath).toBe(configPath);
    });
  });

  it("defaults to ~/.astroclaw/astroclaw.json when config is missing", async () => {
    await withTempHome(async (home) => {
      const io = createIoForHome(home);
      expect(io.configPath).toBe(path.join(home, ".astroclaw", "astroclaw.json"));
    });
  });

  it("uses ASTROCLAW_HOME for default config path", async () => {
    await withTempHome(async (home) => {
      const io = createConfigIO({
        env: { ASTROCLAW_HOME: path.join(home, "svc-home") } as NodeJS.ProcessEnv,
        homedir: () => path.join(home, "ignored-home"),
      });
      expect(io.configPath).toBe(path.join(home, "svc-home", ".astroclaw", "astroclaw.json"));
    });
  });

  it("honors explicit ASTROCLAW_CONFIG_PATH override", async () => {
    await withTempHome(async (home) => {
      const customPath = await writeConfig(home, ".astroclaw", 20002, "custom.json");
      const io = createIoForHome(home, { ASTROCLAW_CONFIG_PATH: customPath } as NodeJS.ProcessEnv);
      expect(io.configPath).toBe(customPath);
    });
  });

  it("logs validation warnings with real line breaks", async () => {
    await withTempHome(async (home) => {
      const configPath = path.join(home, ".astroclaw", "astroclaw.json");
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(
        configPath,
        JSON.stringify(
          {
            plugins: {
              entries: {
                "google-antigravity-auth": {
                  enabled: false,
                  config: { stale: true },
                },
              },
            },
          },
          null,
          2,
        ),
      );
      const logger = {
        error: vi.fn(),
        warn: vi.fn(),
      };

      const io = createConfigIO({
        configPath,
        env: {} as NodeJS.ProcessEnv,
        homedir: () => home,
        logger,
      });
      io.loadConfig();

      expect(logger.warn).toHaveBeenCalledWith(
        "Config warnings:\n- plugins.entries.google-antigravity-auth: plugin removed: google-antigravity-auth (stale config entry ignored; remove it from plugins config)",
      );
      expect(logger.warn).not.toHaveBeenCalledWith("Config warnings:\\n");
    });
  });

  it("explains what to check when config was written by a newer Astroclaw", async () => {
    await withTempHome(async (home) => {
      const configPath = path.join(home, ".astroclaw", "astroclaw.json");
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(
        configPath,
        JSON.stringify(
          {
            meta: { lastTouchedVersion: "9999.1.1" },
            gateway: { mode: "local" },
          },
          null,
          2,
        ),
      );
      const logger = {
        error: vi.fn(),
        warn: vi.fn(),
      };

      const io = createConfigIO({
        configPath,
        env: {} as NodeJS.ProcessEnv,
        homedir: () => home,
        logger,
      });
      io.loadConfig();

      expect(logger.warn).toHaveBeenCalledWith(
        [
          `Your Astroclaw config was written by version 9999.1.1, but this command is running ${VERSION}.`,
          "Check: `astroclaw --version`, `which astroclaw`, and `astroclaw gateway status --deep`.",
          "If unexpected, update PATH so `astroclaw` points to the version you want, or reinstall the Gateway service from that same Astroclaw install.",
        ].join("\n"),
      );
    });
  });

  it("normalizes safe-bin config entries at config load time", () => {
    const cfg = {
      tools: {
        exec: {
          safeBinTrustedDirs: [" /custom/bin ", "", "/custom/bin", "/agent/bin"],
          safeBinProfiles: {
            " MyFilter ": {
              allowedValueFlags: ["--limit", " --limit ", ""],
            },
          },
        },
      },
      agents: {
        list: [
          {
            id: "ops",
            tools: {
              exec: {
                safeBinTrustedDirs: [" /ops/bin ", "/ops/bin"],
                safeBinProfiles: {
                  " Custom ": {
                    deniedFlags: ["-f", " -f ", ""],
                  },
                },
              },
            },
          },
        ],
      },
    };
    normalizeExecSafeBinProfilesInConfig(cfg);
    expect(cfg.tools?.exec?.safeBinProfiles).toEqual({
      myfilter: {
        allowedValueFlags: ["--limit"],
      },
    });
    expect(cfg.tools?.exec?.safeBinTrustedDirs).toEqual(["/custom/bin", "/agent/bin"]);
    expect(cfg.agents?.list?.[0]?.tools?.exec?.safeBinProfiles).toEqual({
      custom: {
        deniedFlags: ["-f"],
      },
    });
    expect(cfg.agents?.list?.[0]?.tools?.exec?.safeBinTrustedDirs).toEqual(["/ops/bin"]);
  });

  it("moves WhatsApp shared access defaults into accounts.default during runtime compat", () => {
    const migrated = normalizeCompatibilityConfigValues({
      channels: {
        whatsapp: {
          enabled: true,
          dmPolicy: "allowlist",
          allowFrom: ["+15550001111"],
          groupPolicy: "open",
          groupAllowFrom: [],
          accounts: {
            work: {
              enabled: true,
              authDir: "/tmp/wa-work",
            },
          },
        },
      },
    } as AstroclawConfig);
    expect(migrated.config.channels?.whatsapp?.accounts?.default).toEqual({
      dmPolicy: "allowlist",
      allowFrom: ["+15550001111"],
      groupPolicy: "open",
      groupAllowFrom: [],
    });
  });
});
