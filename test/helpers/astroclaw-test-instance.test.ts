import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createAstroclawTestInstance } from "./astroclaw-test-instance.js";

async function expectPathMissing(targetPath: string): Promise<void> {
  try {
    await fs.stat(targetPath);
  } catch (error) {
    expect((error as NodeJS.ErrnoException).code).toBe("ENOENT");
    return;
  }
  throw new Error(`Expected missing path: ${targetPath}`);
}

describe("astroclaw test instance", () => {
  it("creates isolated config and spawn env without mutating process env", async () => {
    const previousHome = process.env.HOME;
    const inst = await createAstroclawTestInstance({
      name: "instance-unit",
      gatewayToken: "gateway-token",
      hookToken: "hook-token",
      config: {
        gateway: {
          bind: "loopback",
        },
      },
      env: {
        ASTROCLAW_SKIP_CRON: "0",
      },
    });

    try {
      expect(process.env.HOME).toBe(previousHome);
      expect(inst.homeDir).toBe(path.join(inst.state.root, "home"));
      expect(inst.stateDir).toBe(path.join(inst.homeDir, ".astroclaw"));
      expect(inst.configPath).toBe(path.join(inst.stateDir, "astroclaw.json"));
      expect(inst.env.HOME).toBe(inst.homeDir);
      expect(inst.env.ASTROCLAW_STATE_DIR).toBe(inst.stateDir);
      expect(inst.env.ASTROCLAW_CONFIG_PATH).toBe(inst.configPath);
      expect(inst.env.ASTROCLAW_SKIP_CRON).toBe("0");

      const config = JSON.parse(await fs.readFile(inst.configPath, "utf8"));
      expect(config).toStrictEqual({
        gateway: {
          bind: "loopback",
          port: inst.port,
          auth: {
            mode: "token",
            token: "gateway-token",
          },
          controlUi: {
            enabled: false,
          },
        },
        hooks: {
          enabled: true,
          token: "hook-token",
          path: "/hooks",
        },
      });
    } finally {
      await inst.cleanup();
    }

    await expectPathMissing(inst.state.root);
  });
});
