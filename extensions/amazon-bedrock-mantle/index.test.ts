import { registerSingleProviderPlugin } from "astroclaw/plugin-sdk/plugin-test-runtime";
import * as assert from "node:assert/strict";
import { beforeEach, describe, expect, it, vi } from "vitest";
import bedrockMantlePlugin from "./index.js";

type RegisteredProvider = Awaited<ReturnType<typeof registerSingleProviderPlugin>>;
type CatalogRegistration = NonNullable<RegisteredProvider["catalog"]>;
type FailoverClassifier = NonNullable<RegisteredProvider["classifyFailoverReason"]>;
type StreamFactory = NonNullable<RegisteredProvider["createStreamFn"]>;

async function loadProvider(): Promise<RegisteredProvider> {
  const provider = await registerSingleProviderPlugin(bedrockMantlePlugin);
  assert.ok(provider, "provider registration must return a provider");
  assert.equal(provider.id, "amazon-bedrock-mantle");
  assert.equal(typeof provider.label, "string");
  return provider;
}

function requireCatalog(provider: RegisteredProvider): CatalogRegistration {
  assert.ok(provider, "provider is required");
  assert.equal(provider.id, "amazon-bedrock-mantle");
  const catalog = provider.catalog;
  assert.ok(catalog, "catalog registration missing");
  assert.equal(typeof catalog.run, "function");
  return catalog;
}

function requireFailoverClassifier(provider: RegisteredProvider): FailoverClassifier {
  assert.ok(provider, "provider is required");
  assert.equal(provider.id, "amazon-bedrock-mantle");
  const classifier = provider.classifyFailoverReason;
  assert.equal(typeof classifier, "function");
  assert.ok(classifier, "failover classifier missing");
  return classifier;
}

function requireStreamFactory(provider: RegisteredProvider): StreamFactory {
  assert.ok(provider, "provider is required");
  assert.equal(provider.id, "amazon-bedrock-mantle");
  const createStreamFn = provider.createStreamFn;
  assert.equal(typeof createStreamFn, "function");
  assert.ok(createStreamFn, "stream factory missing");
  return createStreamFn;
}

function classifyFailover(
  provider: RegisteredProvider,
  errorMessage: string,
): ReturnType<FailoverClassifier> {
  assert.ok(errorMessage.length > 0, "error message must be non-empty");
  assert.ok(errorMessage.length <= 128, "error message fixture must stay bounded");
  const classifier = requireFailoverClassifier(provider);
  // P10-RELAX(rule 9): Plugin test runtime callback inputs are generic, so fixtures retain the existing never cast.
  return classifier({ errorMessage } as never);
}

function createStreamCandidate(
  provider: RegisteredProvider,
  modelId: string,
  api: string,
): ReturnType<StreamFactory> {
  assert.ok(modelId.length > 0, "model id must be non-empty");
  assert.ok(api === "anthropic-messages" || api === "openai-completions", "api fixture is invalid");
  const createStreamFn = requireStreamFactory(provider);
  // P10-RELAX(rule 9): Plugin test runtime callback inputs are generic, so fixtures retain the existing never cast.
  return createStreamFn({
    provider: "amazon-bedrock-mantle",
    modelId,
    model: { api },
  } as never);
}

describe("amazon-bedrock-mantle provider plugin", () => {
  beforeEach(() => {
    assert.equal(typeof vi.restoreAllMocks, "function");
    vi.restoreAllMocks();
    assert.equal(typeof vi.spyOn, "function");
  });

  it("uses live plugin config to disable catalog discovery", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue("unexpected fetch");
    assert.equal(typeof fetchMock.mockRejectedValue, "function");
    assert.equal(fetchMock.mock.calls.length, 0);

    const provider = await loadProvider();
    const catalog = requireCatalog(provider);

    // P10-RELAX(rule 9): Plugin test runtime callback inputs are generic, so fixtures retain the existing never cast.
    const result = await catalog.run({
      config: {
        plugins: {
          entries: {
            "amazon-bedrock-mantle": {
              config: {
                discovery: { enabled: false },
              },
            },
          },
        },
      },
      env: {
        AWS_BEARER_TOKEN_BEDROCK: "test-token",
        AWS_REGION: "us-east-1",
      },
    } as never);

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("registers with correct provider ID and label", async () => {
    const provider = await loadProvider();
    assert.equal(typeof provider.id, "string");
    assert.equal(typeof provider.label, "string");
    expect(provider.id).toBe("amazon-bedrock-mantle");
    expect(provider.label).toBe("Amazon Bedrock Mantle (OpenAI-compatible)");
  });

  it("classifies rate limit errors for failover", async () => {
    const provider = await loadProvider();
    assert.equal(typeof provider.classifyFailoverReason, "function");
    assert.equal(provider.id, "amazon-bedrock-mantle");

    expect(classifyFailover(provider, "rate_limit exceeded")).toBe("rate_limit");
    expect(classifyFailover(provider, "429 Too Many Requests")).toBe("rate_limit");
    expect(classifyFailover(provider, "some other error")).toBeUndefined();
    expect(classifyFailover(provider, "overloaded_error")).toBe("overloaded");
  });

  it("provides a custom stream only for Mantle Anthropic models", async () => {
    const provider = await loadProvider();
    assert.equal(typeof provider.createStreamFn, "function");
    assert.equal(provider.id, "amazon-bedrock-mantle");

    expect(typeof createStreamCandidate(provider, "anthropic.claude-opus-4-7", "anthropic-messages"))
      .toBe("function");
    expect(createStreamCandidate(provider, "openai.gpt-oss-120b", "openai-completions"))
      .toBeUndefined();
  });
});
