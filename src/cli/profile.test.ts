import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs([
      "node",
      "astroclaw",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "astroclaw", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("leaves gateway --dev for subcommands after leading root options", () => {
    const res = parseCliProfileArgs([
      "node",
      "astroclaw",
      "--no-color",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual([
      "node",
      "astroclaw",
      "--no-color",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "astroclaw", "--dev", "gateway"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "astroclaw", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "astroclaw", "--profile", "work", "status"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "astroclaw", "status"]);
  });

  it("parses interleaved --profile after the command token", () => {
    const res = parseCliProfileArgs(["node", "astroclaw", "status", "--profile", "work", "--deep"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "astroclaw", "status", "--deep"]);
  });

  it("preserves Matrix QA --profile for the command parser", () => {
    const res = parseCliProfileArgs([
      "node",
      "astroclaw",
      "qa",
      "matrix",
      "--profile",
      "fast",
      "--fail-fast",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual([
      "node",
      "astroclaw",
      "qa",
      "matrix",
      "--profile",
      "fast",
      "--fail-fast",
    ]);
  });

  it("preserves Matrix QA --profile after leading root options", () => {
    const res = parseCliProfileArgs([
      "node",
      "astroclaw",
      "--no-color",
      "qa",
      "matrix",
      "--profile=fast",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "astroclaw", "--no-color", "qa", "matrix", "--profile=fast"]);
  });

  it("still parses root --profile before Matrix QA", () => {
    const res = parseCliProfileArgs([
      "node",
      "astroclaw",
      "--profile",
      "work",
      "qa",
      "matrix",
      "--fail-fast",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "astroclaw", "qa", "matrix", "--fail-fast"]);
  });

  it("parses interleaved --dev after the command token", () => {
    const res = parseCliProfileArgs(["node", "astroclaw", "status", "--dev"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "astroclaw", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "astroclaw", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it.each([
    ["--dev first", ["node", "astroclaw", "--dev", "--profile", "work", "status"]],
    ["--profile first", ["node", "astroclaw", "--profile", "work", "--dev", "status"]],
    ["interleaved after command", ["node", "astroclaw", "status", "--profile", "work", "--dev"]],
  ])("rejects combining --dev with --profile (%s)", (_name, argv) => {
    const res = parseCliProfileArgs(argv);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join(path.resolve("/home/peter"), ".astroclaw-dev");
    expect(env.ASTROCLAW_PROFILE).toBe("dev");
    expect(env.ASTROCLAW_STATE_DIR).toBe(expectedStateDir);
    expect(env.ASTROCLAW_CONFIG_PATH).toBe(path.join(expectedStateDir, "astroclaw.json"));
    expect(env.ASTROCLAW_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      ASTROCLAW_STATE_DIR: "/custom",
      ASTROCLAW_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.ASTROCLAW_STATE_DIR).toBe("/custom");
    expect(env.ASTROCLAW_GATEWAY_PORT).toBe("19099");
    expect(env.ASTROCLAW_CONFIG_PATH).toBe(path.join("/custom", "astroclaw.json"));
  });

  it("uses ASTROCLAW_HOME when deriving profile state dir", () => {
    const env: Record<string, string | undefined> = {
      ASTROCLAW_HOME: "/srv/astroclaw-home",
      HOME: "/home/other",
    };
    applyCliProfileEnv({
      profile: "work",
      env,
      homedir: () => "/home/fallback",
    });

    const resolvedHome = path.resolve("/srv/astroclaw-home");
    expect(env.ASTROCLAW_STATE_DIR).toBe(path.join(resolvedHome, ".astroclaw-work"));
    expect(env.ASTROCLAW_CONFIG_PATH).toBe(
      path.join(resolvedHome, ".astroclaw-work", "astroclaw.json"),
    );
  });
});

describe("formatCliCommand", () => {
  it.each([
    {
      name: "no profile is set",
      cmd: "astroclaw doctor --fix",
      env: {},
      expected: "astroclaw doctor --fix",
    },
    {
      name: "profile is default",
      cmd: "astroclaw doctor --fix",
      env: { ASTROCLAW_PROFILE: "default" },
      expected: "astroclaw doctor --fix",
    },
    {
      name: "profile is Default (case-insensitive)",
      cmd: "astroclaw doctor --fix",
      env: { ASTROCLAW_PROFILE: "Default" },
      expected: "astroclaw doctor --fix",
    },
    {
      name: "profile is invalid",
      cmd: "astroclaw doctor --fix",
      env: { ASTROCLAW_PROFILE: "bad profile" },
      expected: "astroclaw doctor --fix",
    },
    {
      name: "--profile is already present",
      cmd: "astroclaw --profile work doctor --fix",
      env: { ASTROCLAW_PROFILE: "work" },
      expected: "astroclaw --profile work doctor --fix",
    },
    {
      name: "--dev is already present",
      cmd: "astroclaw --dev doctor",
      env: { ASTROCLAW_PROFILE: "dev" },
      expected: "astroclaw --dev doctor",
    },
  ])("returns command unchanged when $name", ({ cmd, env, expected }) => {
    expect(formatCliCommand(cmd, env)).toBe(expected);
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("astroclaw doctor --fix", { ASTROCLAW_PROFILE: "work" })).toBe(
      "astroclaw --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(formatCliCommand("astroclaw doctor --fix", { ASTROCLAW_PROFILE: "  jbastroclaw  " })).toBe(
      "astroclaw --profile jbastroclaw doctor --fix",
    );
  });

  it("handles command with no args after astroclaw", () => {
    expect(formatCliCommand("astroclaw", { ASTROCLAW_PROFILE: "test" })).toBe(
      "astroclaw --profile test",
    );
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm astroclaw doctor", { ASTROCLAW_PROFILE: "work" })).toBe(
      "pnpm astroclaw --profile work doctor",
    );
  });

  it("inserts --container when a container hint is set", () => {
    expect(
      formatCliCommand("astroclaw gateway status --deep", { ASTROCLAW_CONTAINER_HINT: "demo" }),
    ).toBe("astroclaw --container demo gateway status --deep");
  });

  it("ignores unsafe container hints", () => {
    expect(
      formatCliCommand("astroclaw gateway status --deep", {
        ASTROCLAW_CONTAINER_HINT: "demo; rm -rf /",
      }),
    ).toBe("astroclaw gateway status --deep");
  });

  it("preserves both --container and --profile hints", () => {
    expect(
      formatCliCommand("astroclaw doctor", {
        ASTROCLAW_CONTAINER_HINT: "demo",
        ASTROCLAW_PROFILE: "work",
      }),
    ).toBe("astroclaw --container demo doctor");
  });

  it("does not prepend --container for update commands", () => {
    expect(formatCliCommand("astroclaw update", { ASTROCLAW_CONTAINER_HINT: "demo" })).toBe(
      "astroclaw update",
    );
    expect(
      formatCliCommand("pnpm astroclaw update --channel beta", { ASTROCLAW_CONTAINER_HINT: "demo" }),
    ).toBe("pnpm astroclaw update --channel beta");
  });
});
