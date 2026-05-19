import { strict as assert } from "node:assert";
import { describePluginRegistrationContract } from "astroclaw/plugin-sdk/plugin-test-contracts";

const PLUGIN_ID = "alibaba";
const VIDEO_GENERATION_PROVIDER_IDS: readonly string[] = [PLUGIN_ID];
const REQUIRE_GENERATE_VIDEO = true;

assert.equal(PLUGIN_ID, "alibaba", "pluginId must match the registered Alibaba provider");
assert.ok(PLUGIN_ID.length > 0, "pluginId must be non-empty");
assert.equal(VIDEO_GENERATION_PROVIDER_IDS.length, 1, "exactly one video provider is expected");
assert.equal(
  VIDEO_GENERATION_PROVIDER_IDS[0],
  PLUGIN_ID,
  "video provider id must match pluginId",
);

const contractResult = describePluginRegistrationContract({
  pluginId: PLUGIN_ID,
  videoGenerationProviderIds: [...VIDEO_GENERATION_PROVIDER_IDS],
  requireGenerateVideo: REQUIRE_GENERATE_VIDEO,
});

assert.equal(contractResult, undefined, "registration contract must complete synchronously");
