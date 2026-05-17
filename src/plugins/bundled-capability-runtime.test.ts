import { describe, expect, it } from "vitest";
import { buildVitestCapabilityShimAliasMap } from "./bundled-capability-runtime.js";

describe("buildVitestCapabilityShimAliasMap", () => {
  it("keeps scoped and unscoped capability shim aliases aligned", () => {
    const aliasMap = buildVitestCapabilityShimAliasMap();

    expect(aliasMap["astroclaw/plugin-sdk/config-runtime"]).toBe(
      aliasMap["@astroclaw/plugin-sdk/config-runtime"],
    );
    expect(aliasMap["astroclaw/plugin-sdk/media-runtime"]).toBe(
      aliasMap["@astroclaw/plugin-sdk/media-runtime"],
    );
    expect(aliasMap["astroclaw/plugin-sdk/provider-onboard"]).toBe(
      aliasMap["@astroclaw/plugin-sdk/provider-onboard"],
    );
    expect(aliasMap["astroclaw/plugin-sdk/speech-core"]).toBe(
      aliasMap["@astroclaw/plugin-sdk/speech-core"],
    );
  });
});
