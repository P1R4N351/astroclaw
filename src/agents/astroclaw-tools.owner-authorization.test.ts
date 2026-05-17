import { describe, expect, it } from "vitest";
import {
  isAstroclawOwnerOnlyCoreToolName,
  ASTROCLAW_OWNER_ONLY_CORE_TOOL_NAMES,
} from "./tools/owner-only-tools.js";

describe("createAstroclawTools owner authorization", () => {
  it("marks owner-only core tool names", () => {
    expect(ASTROCLAW_OWNER_ONLY_CORE_TOOL_NAMES).toEqual(["cron", "gateway", "nodes"]);
    expect(isAstroclawOwnerOnlyCoreToolName("cron")).toBe(true);
    expect(isAstroclawOwnerOnlyCoreToolName("gateway")).toBe(true);
    expect(isAstroclawOwnerOnlyCoreToolName("nodes")).toBe(true);
  });

  it("keeps canvas non-owner-only", () => {
    expect(isAstroclawOwnerOnlyCoreToolName("canvas")).toBe(false);
  });
});
