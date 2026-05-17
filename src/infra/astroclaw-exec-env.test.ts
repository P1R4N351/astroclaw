import { describe, expect, it } from "vitest";
import {
  ensureAstroclawExecMarkerOnProcess,
  markAstroclawExecEnv,
  ASTROCLAW_CLI_ENV_VALUE,
  ASTROCLAW_CLI_ENV_VAR,
} from "./astroclaw-exec-env.js";

describe("markAstroclawExecEnv", () => {
  it("returns a cloned env object with the exec marker set", () => {
    const env = { PATH: "/usr/bin", ASTROCLAW_CLI: "0" };
    const marked = markAstroclawExecEnv(env);

    expect(marked).toEqual({
      PATH: "/usr/bin",
      ASTROCLAW_CLI: ASTROCLAW_CLI_ENV_VALUE,
    });
    expect(marked).not.toBe(env);
    expect(env.ASTROCLAW_CLI).toBe("0");
  });
});

describe("ensureAstroclawExecMarkerOnProcess", () => {
  it.each([
    {
      name: "mutates and returns the provided process env",
      env: { PATH: "/usr/bin" } as NodeJS.ProcessEnv,
    },
    {
      name: "overwrites an existing marker on the provided process env",
      env: { PATH: "/usr/bin", [ASTROCLAW_CLI_ENV_VAR]: "0" } as NodeJS.ProcessEnv,
    },
  ])("$name", ({ env }) => {
    expect(ensureAstroclawExecMarkerOnProcess(env)).toBe(env);
    expect(env[ASTROCLAW_CLI_ENV_VAR]).toBe(ASTROCLAW_CLI_ENV_VALUE);
  });

  it("defaults to mutating process.env when no env object is provided", () => {
    const previous = process.env[ASTROCLAW_CLI_ENV_VAR];
    delete process.env[ASTROCLAW_CLI_ENV_VAR];

    try {
      expect(ensureAstroclawExecMarkerOnProcess()).toBe(process.env);
      expect(process.env[ASTROCLAW_CLI_ENV_VAR]).toBe(ASTROCLAW_CLI_ENV_VALUE);
    } finally {
      if (previous === undefined) {
        delete process.env[ASTROCLAW_CLI_ENV_VAR];
      } else {
        process.env[ASTROCLAW_CLI_ENV_VAR] = previous;
      }
    }
  });
});
