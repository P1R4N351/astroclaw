import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { withTempDir } from "./test-helpers/temp-dir.js";
import {
  ensureDir,
  resolveConfigDir,
  resolveHomeDir,
  resolveUserPath,
  shortenHomeInString,
  shortenHomePath,
  sleep,
} from "./utils.js";

describe("ensureDir", () => {
  it("creates nested directory", async () => {
    await withTempDir({ prefix: "astroclaw-test-" }, async (tmp) => {
      const target = path.join(tmp, "nested", "dir");
      await ensureDir(target);
      expect(fs.existsSync(target)).toBe(true);
    });
  });
});

describe("sleep", () => {
  it("resolves after delay using fake timers", async () => {
    vi.useFakeTimers();
    try {
      const promise = sleep(1000);
      vi.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("resolveConfigDir", () => {
  it("prefers ~/.astroclaw when legacy dir is missing", async () => {
    await withTempDir({ prefix: "astroclaw-config-dir-" }, async (root) => {
      const newDir = path.join(root, ".astroclaw");
      await fs.promises.mkdir(newDir, { recursive: true });
      const resolved = resolveConfigDir({} as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(newDir);
    });
  });

  it("expands ASTROCLAW_STATE_DIR using the provided env", () => {
    const env = {
      HOME: "/tmp/astroclaw-home",
      ASTROCLAW_STATE_DIR: "~/state",
    } as NodeJS.ProcessEnv;

    expect(resolveConfigDir(env)).toBe(path.resolve("/tmp/astroclaw-home", "state"));
  });

  it("falls back to the config file directory when only ASTROCLAW_CONFIG_PATH is set", () => {
    const env = {
      HOME: "/tmp/astroclaw-home",
      ASTROCLAW_CONFIG_PATH: "~/profiles/dev/astroclaw.json",
    } as NodeJS.ProcessEnv;

    expect(resolveConfigDir(env)).toBe(path.resolve("/tmp/astroclaw-home", "profiles", "dev"));
  });
});

describe("resolveHomeDir", () => {
  it("prefers ASTROCLAW_HOME over HOME", () => {
    vi.stubEnv("ASTROCLAW_HOME", "/srv/astroclaw-home");
    vi.stubEnv("HOME", "/home/other");
    try {
      expect(resolveHomeDir()).toBe(path.resolve("/srv/astroclaw-home"));
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("shortenHomePath", () => {
  it("uses $ASTROCLAW_HOME prefix when ASTROCLAW_HOME is set", () => {
    vi.stubEnv("ASTROCLAW_HOME", "/srv/astroclaw-home");
    vi.stubEnv("HOME", "/home/other");
    try {
      expect(shortenHomePath(`${path.resolve("/srv/astroclaw-home")}/.astroclaw/astroclaw.json`)).toBe(
        "$ASTROCLAW_HOME/.astroclaw/astroclaw.json",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("shortenHomeInString", () => {
  it("uses $ASTROCLAW_HOME replacement when ASTROCLAW_HOME is set", () => {
    vi.stubEnv("ASTROCLAW_HOME", "/srv/astroclaw-home");
    vi.stubEnv("HOME", "/home/other");
    try {
      expect(
        shortenHomeInString(
          `config: ${path.resolve("/srv/astroclaw-home")}/.astroclaw/astroclaw.json`,
        ),
      ).toBe("config: $ASTROCLAW_HOME/.astroclaw/astroclaw.json");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("resolveUserPath", () => {
  it("expands ~ to home dir", () => {
    expect(resolveUserPath("~", {}, () => "/Users/thoffman")).toBe(path.resolve("/Users/thoffman"));
  });

  it("expands ~/ to home dir", () => {
    expect(resolveUserPath("~/astroclaw", {}, () => "/Users/thoffman")).toBe(
      path.resolve("/Users/thoffman", "astroclaw"),
    );
  });

  it("resolves relative paths", () => {
    expect(resolveUserPath("tmp/dir")).toBe(path.resolve("tmp/dir"));
  });

  it("prefers ASTROCLAW_HOME for tilde expansion", () => {
    vi.stubEnv("ASTROCLAW_HOME", "/srv/astroclaw-home");
    vi.stubEnv("HOME", "/home/other");
    try {
      expect(resolveUserPath("~/astroclaw")).toBe(path.resolve("/srv/astroclaw-home", "astroclaw"));
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("uses the provided env for tilde expansion", () => {
    const env = {
      HOME: "/tmp/astroclaw-home",
      ASTROCLAW_HOME: "/srv/astroclaw-home",
    } as NodeJS.ProcessEnv;

    expect(resolveUserPath("~/astroclaw", env)).toBe(path.resolve("/srv/astroclaw-home", "astroclaw"));
  });

  it("keeps blank paths blank", () => {
    expect(resolveUserPath("")).toBe("");
    expect(resolveUserPath("   ")).toBe("");
  });

  it("returns empty string for undefined/null input", () => {
    expect(resolveUserPath(undefined as unknown as string)).toBe("");
    expect(resolveUserPath(null as unknown as string)).toBe("");
  });
});
