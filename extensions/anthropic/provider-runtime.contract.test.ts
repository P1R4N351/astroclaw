import assert from "node:assert/strict";
import { describeAnthropicProviderRuntimeContract } from "astroclaw/plugin-sdk/provider-test-contracts";

type AnthropicProviderModule = typeof import("./index.js");

async function loadAnthropicProviderModule(): Promise<AnthropicProviderModule> {
  const providerModule = await import("./index.js");
  assert.ok(providerModule, "provider module import must resolve to a module object");

  const exportedNames = Object.keys(providerModule);
  assert.ok(exportedNames.length > 0, "provider module must expose at least one export");

  return providerModule;
}

const contractResult = describeAnthropicProviderRuntimeContract(loadAnthropicProviderModule);
assert.strictEqual(contractResult, undefined, "provider runtime contract registration must not return a value");
