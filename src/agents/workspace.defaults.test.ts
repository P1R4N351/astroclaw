import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveDefaultAgentWorkspaceDir } from "./workspace.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("DEFAULT_AGENT_WORKSPACE_DIR", () => {
  it("uses ASTROCLAW_HOME when resolving the default workspace dir", () => {
    const home = path.join(path.sep, "srv", "astroclaw-home");
    vi.stubEnv("ASTROCLAW_HOME", home);
    vi.stubEnv("HOME", path.join(path.sep, "home", "other"));

    expect(resolveDefaultAgentWorkspaceDir()).toBe(
      path.join(path.resolve(home), ".astroclaw", "workspace"),
    );
  });

  it("uses ASTROCLAW_WORKSPACE_DIR before ASTROCLAW_HOME", () => {
    const workspaceDir = path.join(path.sep, "srv", "astroclaw-workspace");
    vi.stubEnv("ASTROCLAW_WORKSPACE_DIR", workspaceDir);
    vi.stubEnv("ASTROCLAW_HOME", path.join(path.sep, "srv", "astroclaw-home"));

    expect(resolveDefaultAgentWorkspaceDir()).toBe(path.resolve(workspaceDir));
  });
});
