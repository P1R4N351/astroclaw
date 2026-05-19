import assert from "node:assert/strict";
import type {
  ProviderResolveDynamicModelContext,
  ProviderRuntimeModel,
} from "astroclaw/plugin-sdk/plugin-entry";
import {
  capturePluginRegistration,
  registerSingleProviderPlugin,
} from "astroclaw/plugin-sdk/plugin-test-runtime";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const MAX_MODELS = 16;
const MAX_EXPECTED_FIELDS = 16;
const MAX_THINKING_LEVELS = 16;
const MAX_CLI_AUTH_METHODS = 16;
const EXPECTED_CLAUDE_CLI_DEFAULT_MODEL_COUNT = 6;
const EXPECTED_OPUS_4_7_NORMALIZATION_CASES = 2;

const CLAUDE_CLI_DEFAULT_MODEL_IDS = [
  "anthropic/claude-opus-4-7",
  "anthropic/claude-sonnet-4-6",
  "anthropic/claude-opus-4-6",
  "anthropic/claude-opus-4-5",
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-haiku-4-5",
] as const;

const OPUS_4_7_NORMALIZATION_CASES = [
  ["anthropic", "claude-opus-4-7"],
  ["claude-cli", "claude-opus-4.7-20260219"],
] as const;

const OAUTH_ACCESS_FIXTURE = "fixture-access";
const OAUTH_REFRESH_FIXTURE = "fixture-refresh";
const OAUTH_SETUP_ACCESS_FIXTURE = "fixture-setup-access";
const BEARER_FIXTURE = "fixture-bearer";

const { readClaudeCliCredentialsForSetupMock, readClaudeCliCredentialsForRuntimeMock } = vi.hoisted(
  () => ({
    readClaudeCliCredentialsForSetupMock: vi.fn(),
    readClaudeCliCredentialsForRuntimeMock: vi.fn(),
  }),
);

vi.mock("./cli-auth-seam.js", () => {
  return {
    readClaudeCliCredentialsForSetup: readClaudeCliCredentialsForSetupMock,
    readClaudeCliCredentialsForRuntime: readClaudeCliCredentialsForRuntimeMock,
  };
});

import anthropicPlugin from "./index.js";

type ModelRegistry = {
  find(providerId: string, modelId: string): ProviderRuntimeModel | null;
};

type FieldMap = Readonly<Record<string, unknown>>;

beforeEach(() => {
  const setupMock = readClaudeCliCredentialsForSetupMock.mockReset();
  const runtimeMock = readClaudeCliCredentialsForRuntimeMock.mockReset();
  assert.equal(setupMock, readClaudeCliCredentialsForSetupMock);
  assert.equal(runtimeMock, readClaudeCliCredentialsForRuntimeMock);
});

afterAll(() => {
  vi.doUnmock("./cli-auth-seam.js");
  vi.resetModules();
  expect(vi.isMockFunction(readClaudeCliCredentialsForSetupMock)).toBe(true);
  expect(vi.isMockFunction(readClaudeCliCredentialsForRuntimeMock)).toBe(true);
});

async function registerProvider(): Promise<Awaited<ReturnType<typeof registerSingleProviderPlugin>>> {
  const provider = await registerSingleProviderPlugin(anthropicPlugin);
  assert.equal(typeof provider, "object");
  assert.notEqual(provider, null);
  return provider;
}

function createClaudeOpus46Model(): ProviderRuntimeModel {
  return {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    api: "anthropic-messages",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 200_000,
    maxTokens: 32_000,
  } as ProviderRuntimeModel;
}

function createModelRegistry(models: ReadonlyArray<ProviderRuntimeModel>): ModelRegistry {
  assert.equal(Array.isArray(models), true);
  assert.ok(models.length <= MAX_MODELS, "model registry fixture exceeds fixed loop bound");
  return {
    find(providerId: string, modelId: string): ProviderRuntimeModel | null {
      assert.ok(providerId.length > 0, "provider id is required");
      assert.ok(modelId.length > 0, "model id is required");
      for (let index = 0; index < MAX_MODELS; index += 1) {
        if (index >= models.length) {
          return null;
        }
        const model = models[index];
        assert.ok(model, "model fixture entry is required");
        if (model.provider === providerId && model.id.toLowerCase() === modelId.toLowerCase()) {
          return model;
        }
      }
      return null;
    },
  };
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  assert.ok(label.length > 0, "record label is required");
  assert.equal(typeof label, "string");
  if (!value || typeof value !== "object") {
    throw new Error(`expected ${label}`);
  }
  return value as Record<string, unknown>;
}

function expectFields(value: unknown, fields: FieldMap): void {
  const record = requireRecord(value, "record");
  const entries = Object.entries(fields);
  assert.ok(entries.length > 0, "expected fields must not be empty");
  assert.ok(entries.length <= MAX_EXPECTED_FIELDS, "field fixture exceeds fixed loop bound");
  for (let index = 0; index < MAX_EXPECTED_FIELDS; index += 1) {
    if (index >= entries.length) {
      return;
    }
    const entry = entries[index];
    assert.ok(entry, "field fixture entry is required");
    const [key, expected] = entry;
    expect(record[key]).toEqual(expected);
  }
}

function expectModelParams(models: unknown, modelId: string, params: FieldMap): void {
  assert.ok(modelId.length > 0, "model id is required");
  assert.ok(Object.keys(params).length > 0, "expected model params are required");
  const model = requireRecord(requireRecord(models, "models")[modelId], modelId);
  expectFields(model.params, params);
}

function levelIds(profile: unknown): Array<unknown> {
  const levels = requireRecord(profile, "thinking profile").levels;
  assert.equal(Array.isArray(levels), true);
  assert.ok(levels.length <= MAX_THINKING_LEVELS, "thinking fixture exceeds fixed loop bound");
  const ids: Array<unknown> = [];
  for (let index = 0; index < MAX_THINKING_LEVELS; index += 1) {
    if (index >= levels.length) {
      return ids;
    }
    const level = levels[index] as { readonly id?: unknown } | undefined;
    assert.ok(level, "thinking level entry is required");
    const nextLength = ids.push(level.id);
    assert.ok(nextLength <= MAX_THINKING_LEVELS, "thinking id output exceeds fixed bound");
  }
  return ids;
}

function expectClaudeCliDefaultModels(modelsValue: unknown): void {
  assert.equal(CLAUDE_CLI_DEFAULT_MODEL_IDS.length, EXPECTED_CLAUDE_CLI_DEFAULT_MODEL_COUNT);
  assert.ok(CLAUDE_CLI_DEFAULT_MODEL_IDS.length <= MAX_EXPECTED_FIELDS);
  const models = requireRecord(modelsValue, "models");
  for (let index = 0; index < EXPECTED_CLAUDE_CLI_DEFAULT_MODEL_COUNT; index += 1) {
    const modelId = CLAUDE_CLI_DEFAULT_MODEL_IDS[index];
    assert.ok(modelId, "default model id is required");
    expect(models[modelId]).toEqual({ agentRuntime: { id: "claude-cli" } });
  }
}

function expectOpus47ResolvedModel(provider: Awaited<ReturnType<typeof registerSingleProviderPlugin>>): void {
  assert.equal(typeof provider.resolveDynamicModel, "function");
  assert.ok(provider.resolveDynamicModel, "dynamic model resolver is required");
  const resolved = provider.resolveDynamicModel({
    provider: "anthropic",
    modelId: "claude-opus-4-7",
    modelRegistry: createModelRegistry([createClaudeOpus46Model()]),
  } as ProviderResolveDynamicModelContext);

  expectFields(resolved, {
    provider: "anthropic",
    id: "claude-opus-4-7",
    api: "anthropic-messages",
    reasoning: true,
    contextWindow: 1_048_576,
    contextTokens: 1_048_576,
  });
}

function expectOpusThinkingProfiles(
  provider: Awaited<ReturnType<typeof registerSingleProviderPlugin>>,
): void {
  assert.equal(typeof provider.resolveThinkingProfile, "function");
  assert.ok(provider.resolveThinkingProfile, "thinking profile resolver is required");
  const opus47Profile = provider.resolveThinkingProfile({
    provider: "anthropic",
    modelId: "claude-opus-4-7",
  } as never);
  const opus47LevelIds = levelIds(opus47Profile);
  expect(opus47LevelIds).toContain("xhigh");
  expect(opus47LevelIds).toContain("adaptive");
  expect(opus47LevelIds).toContain("max");
  expect(requireRecord(opus47Profile, "opus 4.7 thinking profile").defaultLevel).toBe("off");

  const opus46Profile = provider.resolveThinkingProfile({
    provider: "anthropic",
    modelId: "claude-opus-4-6",
  } as never);
  expect(levelIds(opus46Profile)).toContain("adaptive");
  expect(requireRecord(opus46Profile, "opus 4.6 thinking profile").defaultLevel).toBe("adaptive");
  expect(levelIds(opus46Profile)).not.toContain("xhigh");
  expect(levelIds(opus46Profile)).not.toContain("max");
}

function findCliAuth(provider: Awaited<ReturnType<typeof registerSingleProviderPlugin>>) {
  assert.ok(Array.isArray(provider.auth), "provider auth methods are required");
  assert.ok(provider.auth.length <= MAX_CLI_AUTH_METHODS, "auth fixture exceeds fixed loop bound");
  for (let index = 0; index < MAX_CLI_AUTH_METHODS; index += 1) {
    if (index >= provider.auth.length) {
      throw new Error("expected Anthropic CLI auth method");
    }
    const auth = provider.auth[index];
    assert.ok(auth, "auth method entry is required");
    if (auth.id === "cli") {
      return auth;
    }
  }
  throw new Error("expected Anthropic CLI auth method");
}

describe("anthropic provider replay hooks", () => {
  it("registers the claude-cli backend", () => {
    const captured = capturePluginRegistration({ register: anthropicPlugin.register });

    const backend = captured.cliBackends.find((entry) => entry.id === "claude-cli");
    if (!backend) {
      throw new Error("Expected claude-cli backend");
    }
    expect(backend.bundleMcp).toBe(true);
    expectFields(backend.config, {
      command: "claude",
      modelArg: "--model",
      sessionArg: "--session-id",
    });
  });

  it("owns native reasoning output mode for Claude transports", async () => {
    const provider = await registerProvider();
    assert.equal(typeof provider.resolveReasoningOutputMode, "function");
    assert.ok(provider.resolveReasoningOutputMode, "reasoning output resolver is required");

    expect(
      provider.resolveReasoningOutputMode({
        provider: "anthropic",
        modelApi: "anthropic-messages",
        modelId: "claude-sonnet-4-6",
      } as never),
    ).toBe("native");
  });

  it("owns replay policy for Claude transports", async () => {
    const provider = await registerProvider();
    assert.equal(typeof provider.buildReplayPolicy, "function");
    assert.ok(provider.buildReplayPolicy, "replay policy builder is required");

    expect(
      provider.buildReplayPolicy({
        provider: "anthropic",
        modelApi: "anthropic-messages",
        modelId: "claude-sonnet-4-6",
      } as never),
    ).toEqual({
      sanitizeMode: "full",
      sanitizeToolCallIds: true,
      toolCallIdMode: "strict",
      preserveNativeAnthropicToolUseIds: true,
      preserveSignatures: true,
      repairToolUseResultPairing: true,
      validateAnthropicTurns: true,
      allowSyntheticToolResults: true,
    });
  });
});

describe("anthropic provider config normalization hooks", () => {
  it("defaults provider api through plugin config normalization", async () => {
    const provider = await registerProvider();
    assert.equal(typeof provider.normalizeConfig, "function");
    assert.ok(provider.normalizeConfig, "config normalizer is required");

    expect(
      requireRecord(
        provider.normalizeConfig({
          provider: "anthropic",
          providerConfig: {
            models: [{ id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" }],
          },
        } as never),
        "normalized config",
      ).api,
    ).toBe("anthropic-messages");
  });

  it("defaults Claude CLI provider api through plugin config normalization", async () => {
    const provider = await registerProvider();
    assert.equal(typeof provider.normalizeConfig, "function");
    assert.ok(provider.normalizeConfig, "config normalizer is required");

    expect(
      requireRecord(
        provider.normalizeConfig({
          provider: "claude-cli",
          providerConfig: {
            models: [{ id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" }],
          },
        } as never),
        "normalized config",
      ).api,
    ).toBe("anthropic-messages");
  });

  it("does not default non-Anthropic provider api through plugin config normalization", async () => {
    const provider = await registerProvider();
    assert.equal(typeof provider.normalizeConfig, "function");
    assert.ok(provider.normalizeConfig, "config normalizer is required");
    const providerConfig = {
      baseUrl: "https://chatgpt.com/backend-api/codex",
      models: [{ id: "gpt-5.4", name: "GPT-5.4" }],
    };

    expect(
      provider.normalizeConfig({
        provider: "openai-codex",
        providerConfig,
      } as never),
    ).toBe(providerConfig);
  });
});

describe("anthropic provider config default hooks", () => {
  it("applies Anthropic pruning defaults through plugin hooks", async () => {
    const provider = await registerProvider();
    assert.equal(typeof provider.applyConfigDefaults, "function");
    assert.ok(provider.applyConfigDefaults, "config default applier is required");

    const next = provider.applyConfigDefaults({
      provider: "anthropic",
      env: {},
      config: {
        auth: { profiles: { "anthropic:api": { provider: "anthropic", mode: "api_key" } } },
        agents: { defaults: { model: { primary: "anthropic/claude-opus-4-5" } } },
      },
    } as never);

    expectFields(next?.agents?.defaults?.contextPruning, { mode: "cache-ttl", ttl: "1h" });
    expectFields(next?.agents?.defaults?.heartbeat, { every: "30m" });
    expect(
      next?.agents?.defaults?.models?.["anthropic/claude-opus-4-5"]?.params?.cacheRetention,
    ).toBe("short");
  });

  it("backfills Haiku into API-key agent model allowlists", async () => {
    const provider = await registerProvider();
    assert.equal(typeof provider.applyConfigDefaults, "function");
    assert.ok(provider.applyConfigDefaults, "config default applier is required");

    const next = provider.applyConfigDefaults({
      provider: "anthropic",
      env: {},
      config: {
        auth: { profiles: { "anthropic:api": { provider: "anthropic", mode: "api_key" } } },
        agents: {
          defaults: {
            model: { primary: "anthropic/claude-sonnet-4-6" },
            models: { "anthropic/claude-sonnet-4-6": {} },
          },
        },
      },
    } as never);

    const models = next?.agents?.defaults?.models;
    expectModelParams(models, "anthropic/claude-sonnet-4-6", { cacheRetention: "short" });
    expectModelParams(models, "anthropic/claude-haiku-4-5", { cacheRetention: "short" });
  });

  it("backfills Claude CLI allowlist defaults through plugin hooks for older configs", async () => {
    const provider = await registerProvider();
    assert.equal(typeof provider.applyConfigDefaults, "function");
    assert.ok(provider.applyConfigDefaults, "config default applier is required");

    const next = provider.applyConfigDefaults({
      provider: "anthropic",
      env: {},
      config: {
        auth: { profiles: { "anthropic:claude-cli": { provider: "claude-cli", mode: "oauth" } } },
        agents: {
          defaults: {
            agentRuntime: { id: "claude-cli" },
            model: { primary: "anthropic/claude-opus-4-7" },
            models: { "anthropic/claude-opus-4-7": {} },
          },
        },
      },
    } as never);

    expectFields(next?.agents?.defaults?.heartbeat, { every: "1h" });
    expectClaudeCliDefaultModels(next?.agents?.defaults?.models);
  });
});

describe("anthropic provider dynamic model hooks", () => {
  it("resolves explicit claude-opus-4-7 refs from the 4.6 template family", async () => {
    const provider = await registerProvider();

    expectOpus47ResolvedModel(provider);
    expectOpusThinkingProfiles(provider);
  });

  it("does not forward-compat case-mismatched Anthropic model ids", async () => {
    const provider = await registerProvider();
    assert.equal(typeof provider.resolveDynamicModel, "function");
    assert.ok(provider.resolveDynamicModel, "dynamic model resolver is required");

    const resolved = provider.resolveDynamicModel({
      provider: "anthropic",
      modelId: "CLAUDE-OPUS-4-7",
      modelRegistry: createModelRegistry([createClaudeOpus46Model()]),
    } as ProviderResolveDynamicModelContext);

    expect(resolved).toBeUndefined();
  });

  it("normalizes exact claude opus 4.7 variants to 1M context", async () => {
    const provider = await registerProvider();
    assert.equal(typeof provider.normalizeResolvedModel, "function");
    assert.equal(OPUS_4_7_NORMALIZATION_CASES.length, EXPECTED_OPUS_4_7_NORMALIZATION_CASES);

    for (let index = 0; index < EXPECTED_OPUS_4_7_NORMALIZATION_CASES; index += 1) {
      const entry = OPUS_4_7_NORMALIZATION_CASES[index];
      assert.ok(entry, "normalization fixture entry is required");
      const [runtimeProvider, modelId] = entry;
      expectFields(
        provider.normalizeResolvedModel({
          provider: runtimeProvider,
          modelId,
          model: {
            id: modelId,
            name: "Claude Opus 4.7",
            provider: runtimeProvider,
            api: "anthropic-messages",
            reasoning: true,
            input: ["text", "image"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 200_000,
            contextTokens: 200_000,
            maxTokens: 32_000,
          },
        } as never),
        { contextWindow: 1_048_576, contextTokens: 1_048_576 },
      );
    }
  });
});

describe("anthropic provider Claude CLI auth hooks", () => {
  it("resolves claude-cli synthetic oauth auth", async () => {
    const resetMock = readClaudeCliCredentialsForRuntimeMock.mockReset();
    assert.equal(resetMock, readClaudeCliCredentialsForRuntimeMock);
    const configuredMock = readClaudeCliCredentialsForRuntimeMock.mockReturnValue({
      type: "oauth",
      provider: "anthropic",
      access: OAUTH_ACCESS_FIXTURE,
      refresh: OAUTH_REFRESH_FIXTURE,
      expires: 123,
    });
    assert.equal(configuredMock, readClaudeCliCredentialsForRuntimeMock);

    const provider = await registerProvider();
    assert.equal(typeof provider.resolveSyntheticAuth, "function");
    assert.ok(provider.resolveSyntheticAuth, "synthetic auth resolver is required");

    expect(provider.resolveSyntheticAuth({ provider: "claude-cli" } as never)).toEqual({
      apiKey: OAUTH_ACCESS_FIXTURE,
      source: "Claude CLI native auth",
      mode: "oauth",
      expiresAt: 123,
    });
    expect(readClaudeCliCredentialsForRuntimeMock).toHaveBeenCalledTimes(1);
  });

  it("resolves claude-cli synthetic token auth", async () => {
    const resetMock = readClaudeCliCredentialsForRuntimeMock.mockReset();
    assert.equal(resetMock, readClaudeCliCredentialsForRuntimeMock);
    const configuredMock = readClaudeCliCredentialsForRuntimeMock.mockReturnValue({
      type: "token",
      provider: "anthropic",
      token: BEARER_FIXTURE,
      expires: 123,
    });
    assert.equal(configuredMock, readClaudeCliCredentialsForRuntimeMock);

    const provider = await registerProvider();
    assert.equal(typeof provider.resolveSyntheticAuth, "function");
    assert.ok(provider.resolveSyntheticAuth, "synthetic auth resolver is required");

    expect(provider.resolveSyntheticAuth({ provider: "claude-cli" } as never)).toEqual({
      apiKey: BEARER_FIXTURE,
      source: "Claude CLI native auth",
      mode: "token",
      expiresAt: 123,
    });
  });

  it("stores a claude-cli auth profile during anthropic cli migration", async () => {
    const resetMock = readClaudeCliCredentialsForSetupMock.mockReset();
    assert.equal(resetMock, readClaudeCliCredentialsForSetupMock);
    const configuredMock = readClaudeCliCredentialsForSetupMock.mockReturnValue({
      type: "oauth",
      provider: "anthropic",
      access: OAUTH_SETUP_ACCESS_FIXTURE,
      refresh: OAUTH_REFRESH_FIXTURE,
      expires: 123,
    });
    assert.equal(configuredMock, readClaudeCliCredentialsForSetupMock);

    const provider = await registerProvider();
    const cliAuth = findCliAuth(provider);
    const result = await cliAuth.run({ config: {} } as never);

    expect(result?.profiles).toEqual([
      {
        profileId: "anthropic:claude-cli",
        credential: {
          type: "oauth",
          provider: "claude-cli",
          access: OAUTH_SETUP_ACCESS_FIXTURE,
          refresh: OAUTH_REFRESH_FIXTURE,
          expires: 123,
        },
      },
    ]);
  });
});
