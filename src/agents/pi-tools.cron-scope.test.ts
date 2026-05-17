import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnyAgentTool } from "./tools/common.js";

const mocks = vi.hoisted(() => {
  const stubTool = (name: string, ownerOnly = false) =>
    ({
      name,
      label: name,
      displaySummary: name,
      description: name,
      ownerOnly,
      parameters: { type: "object", properties: {} },
      execute: vi.fn(),
    }) satisfies AnyAgentTool;

  return {
    createAstroclawToolsOptions: vi.fn(),
    stubTool,
  };
});

vi.mock("./astroclaw-tools.js", () => ({
  createAstroclawTools: (options: unknown) => {
    mocks.createAstroclawToolsOptions(options);
    return [mocks.stubTool("cron", true)];
  },
}));

import "./test-helpers/fast-bash-tools.js";
import "./test-helpers/fast-coding-tools.js";
import { createAstroclawCodingTools } from "./pi-tools.js";

function firstAstroclawToolsOptions(): { cronSelfRemoveOnlyJobId?: string } | undefined {
  return mocks.createAstroclawToolsOptions.mock.calls[0]?.[0] as
    | { cronSelfRemoveOnlyJobId?: string }
    | undefined;
}

describe("createAstroclawCodingTools cron scope", () => {
  beforeEach(() => {
    mocks.createAstroclawToolsOptions.mockClear();
  });

  it("scopes the cron owner-only runtime grant to self-removal", () => {
    const tools = createAstroclawCodingTools({
      trigger: "cron",
      jobId: "job-current",
      senderIsOwner: false,
      ownerOnlyToolAllowlist: ["cron"],
    });

    expect(tools.map((tool) => tool.name)).toContain("cron");
    expect(firstAstroclawToolsOptions()?.cronSelfRemoveOnlyJobId).toBe("job-current");
  });

  it("does not scope ordinary owner cron sessions", () => {
    createAstroclawCodingTools({
      trigger: "cron",
      jobId: "job-current",
      senderIsOwner: true,
    });

    expect(firstAstroclawToolsOptions()?.cronSelfRemoveOnlyJobId).toBeUndefined();
  });
});
