import { strict as assert } from "node:assert";
import type { ModelDefinitionConfig } from "astroclaw/plugin-sdk/provider-model-types";
import { describe, expect, it } from "vitest";
import {
  applyConfigDefaults,
  normalizeConfig,
  resolveThinkingProfile,
} from "./provider-policy-api.js";

const MAX_POLICY_TEXT_LENGTH = 128;
const MAX_THINKING_LEVELS = 16;
const DEFAULT_CONTEXT_WINDOW = 128_000;
const DEFAULT_MAX_TOKENS = 8_192;

type PolicyLevel = {
  readonly id: string;
};

function assertPolicyText(value: string, label: string): void {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.length > 0, `${label} must be non-empty`);
  assert.ok(value.length <= MAX_POLICY_TEXT_LENGTH, `${label} must be bounded`);
}

function assertLevelsWithinContract(levels: readonly PolicyLevel[]): void {
  assert.ok(Array.isArray(levels), "levels must be an array");
  assert.ok(levels.length <= MAX_THINKING_LEVELS, "levels must be bounded");

  for (let index = 0; index < MAX_THINKING_LEVELS; index += 1) {
    if (index >= levels.length) {
      return;
    }

    const level = levels[index];
    assert.ok(level !== undefined, "level must exist");
    assertPolicyText(level.id, "level.id");
  }
}

// P10-RELAX(rule 3): This test fixture factory allocates isolated model configs per test case.
function createModel(id: string, name: string): ModelDefinitionConfig {
  assertPolicyText(id, "model.id");
  assertPolicyText(name, "model.name");

  return {
    id,
    name,
    reasoning: false,
    input: ["text"],
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MAX_TOKENS,
  };
}

function collectLegacyExtendedLevelIds(levels: readonly PolicyLevel[] | undefined): string[] {
  const ids: string[] = [];

  if (levels === undefined) {
    return ids;
  }

  assertLevelsWithinContract(levels);

  for (let index = 0; index < MAX_THINKING_LEVELS; index += 1) {
    if (index >= levels.length) {
      return ids;
    }

    const level = levels[index];
    assert.ok(level !== undefined, "level must exist");

    if (level.id === "xhigh" || level.id === "max") {
      const nextLength = ids.push(level.id);
      assert.equal(nextLength, ids.length, "push result must match array length");
      assert.ok(nextLength <= MAX_THINKING_LEVELS, "legacy level ids must be bounded");
    }
  }

  return ids;
}

function levelIds(levels: readonly PolicyLevel[] | undefined): string[] {
  const ids: string[] = [];

  if (levels === undefined) {
    return ids;
  }

  assertLevelsWithinContract(levels);

  for (let index = 0; index < MAX_THINKING_LEVELS; index += 1) {
    if (index >= levels.length) {
      return ids;
    }

    const level = levels[index];
    assert.ok(level !== undefined, "level must exist");

    const nextLength = ids.push(level.id);
    assert.equal(nextLength, ids.length, "push result must match array length");
    assert.ok(nextLength <= MAX_THINKING_LEVELS, "level ids must be bounded");
  }

  return ids;
}

// P10-RELAX(rule 3): Vitest cases allocate isolated input fixtures to avoid shared mutable state.
describe("anthropic provider policy public artifact", () => {
  it("normalizes Anthropic provider config", () => {
    const normalized = normalizeConfig({
      provider: "anthropic",
      providerConfig: {
        baseUrl: "https://api.anthropic.com",
        models: [createModel("claude-sonnet-4-6", "Claude Sonnet 4.6")],
      },
    });

    expect(normalized.api).toBe("anthropic-messages");
    expect(normalized.baseUrl).toBe("https://api.anthropic.com");
  });

  it("normalizes Claude CLI provider config", () => {
    const normalized = normalizeConfig({
      provider: "claude-cli",
      providerConfig: {
        baseUrl: "https://api.anthropic.com",
        models: [createModel("claude-sonnet-4-6", "Claude Sonnet 4.6")],
      },
    });

    expect(normalized.api).toBe("anthropic-messages");
  });

  it("does not normalize non-Anthropic provider config", () => {
    const providerConfig = {
      baseUrl: "https://chatgpt.com/backend-api/codex",
      models: [createModel("gpt-5.4", "GPT-5.4")],
    };

    const normalized = normalizeConfig({
      provider: "openai-codex",
      providerConfig,
    });

    expect(normalized).toBe(providerConfig);
  });

  it("applies Anthropic API-key defaults without loading the full provider plugin", () => {
    const nextConfig = applyConfigDefaults({
      config: {
        auth: {
          profiles: {
            "anthropic:default": {
              provider: "anthropic",
              mode: "api_key",
            },
          },
          order: { anthropic: ["anthropic:default"] },
        },
        agents: {
          defaults: {},
        },
      },
      env: {},
    });

    expect(nextConfig.agents?.defaults?.contextPruning?.mode).toBe("cache-ttl");
    expect(nextConfig.agents?.defaults?.contextPruning?.ttl).toBe("1h");
  });

  it("exposes Claude Opus 4.7 thinking levels without loading the full provider plugin", () => {
    const profile = resolveThinkingProfile({
      provider: "anthropic",
      modelId: "claude-opus-4-7",
    });
    const ids = levelIds(profile?.levels);

    expect(ids).toContain("xhigh");
    expect(ids).toContain("adaptive");
    expect(ids).toContain("max");
    expect(profile?.defaultLevel).toBe("off");
  });

  it("keeps adaptive-only Claude profiles aligned with the runtime provider", () => {
    const profile = resolveThinkingProfile({
      provider: "anthropic",
      modelId: "claude-opus-4-6",
    });

    assert.ok(profile !== null, "Expected Anthropic policy profile");
    assert.ok(profile.levels !== undefined, "Expected Anthropic policy levels");

    expect(levelIds(profile.levels)).toContain("adaptive");
    expect(profile.defaultLevel).toBe("adaptive");
    expect(collectLegacyExtendedLevelIds(profile.levels)).toStrictEqual([]);
  });

  it("does not expose Anthropic thinking profiles for unrelated providers", () => {
    const profile = resolveThinkingProfile({
      provider: "openai",
      modelId: "claude-opus-4-7",
    });

    expect(profile).toBeNull();
  });
});
