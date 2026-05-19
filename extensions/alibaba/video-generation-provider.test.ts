import assert from "node:assert/strict";

import {
  getProviderHttpMocks,
  installProviderHttpMockCleanup,
} from "astroclaw/plugin-sdk/provider-http-test-mocks";
import {
  expectDashscopeVideoTaskPoll,
  expectExplicitVideoGenerationCapabilities,
  expectSuccessfulDashscopeVideoResult,
  mockSuccessfulDashscopeVideoTask,
} from "astroclaw/plugin-sdk/provider-test-contracts";
import { beforeAll, describe, expect, it } from "vitest";

type AlibabaVideoGenerationProviderModule = typeof import("./video-generation-provider.js");
type AlibabaVideoGenerationProvider = ReturnType<
  AlibabaVideoGenerationProviderModule["buildAlibabaVideoGenerationProvider"]
>;
type AlibabaVideoGenerationRequest = Parameters<AlibabaVideoGenerationProvider["generateVideo"]>[0];

const DASHSCOPE_VIDEO_SYNTHESIS_URL =
  "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis";
const SUCCESSFUL_MODEL = "wan2.6-r2v-flash";
const SUCCESSFUL_PROMPT = "animate this shot";
const REFERENCE_IMAGE_URL = "https://example.com/ref.png";
const LOCAL_BUFFER_ERROR =
  "Alibaba Wan video generation currently requires remote http(s) URLs for reference images/videos.";

const SUCCESSFUL_VIDEO_REQUEST: AlibabaVideoGenerationRequest = {
  provider: "alibaba",
  model: SUCCESSFUL_MODEL,
  prompt: SUCCESSFUL_PROMPT,
  cfg: {},
  inputImages: [{ url: REFERENCE_IMAGE_URL }],
  durationSeconds: 6,
  audio: true,
  watermark: false,
};

const LOCAL_BUFFER_VIDEO_REQUEST: AlibabaVideoGenerationRequest = {
  provider: "alibaba",
  model: "wan2.6-i2v",
  prompt: "animate this local frame",
  cfg: {},
  inputImages: [{ buffer: Buffer.from("png-bytes"), mimeType: "image/png" }],
};

const { postJsonRequestMock, fetchWithTimeoutMock } = getProviderHttpMocks();

let buildAlibabaVideoGenerationProvider:
  | AlibabaVideoGenerationProviderModule["buildAlibabaVideoGenerationProvider"]
  | undefined;

void beforeAll(async () => {
  const providerModule = await import("./video-generation-provider.js");

  assert.equal(
    typeof providerModule.buildAlibabaVideoGenerationProvider,
    "function",
    "Alibaba video provider module must expose a builder function",
  );
  buildAlibabaVideoGenerationProvider = providerModule.buildAlibabaVideoGenerationProvider;
  assert.equal(
    buildAlibabaVideoGenerationProvider,
    providerModule.buildAlibabaVideoGenerationProvider,
    "Alibaba video provider builder must be installed before tests run",
  );
});

void installProviderHttpMockCleanup();

function buildProviderForTest(): AlibabaVideoGenerationProvider {
  const builder = buildAlibabaVideoGenerationProvider;

  assert.equal(typeof builder, "function", "Alibaba video provider builder must be loaded");
  const provider = builder();
  assert.equal(typeof provider.generateVideo, "function", "provider must expose generateVideo");

  return provider;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  assert.equal(typeof label, "string", "record label must be a string");
  assert.ok(label.length > 0, "record label must not be empty");
  assert.notEqual(value, null, `expected ${label} to be non-null`);
  assert.equal(typeof value, "object", `expected ${label} to be an object`);
  assert.equal(Array.isArray(value), false, `expected ${label} not to be an array`);

  return value as Record<string, unknown>;
}

function requireFirstPostJsonRequest(label: string): Record<string, unknown> {
  assert.equal(typeof label, "string", "request label must be a string");
  assert.ok(label.length > 0, "request label must not be empty");

  const calls = postJsonRequestMock.mock.calls;
  assert.ok(calls.length > 0, `expected ${label}`);
  const firstCall = calls[0];
  assert.ok(firstCall.length > 0, `expected ${label} arguments`);

  return requireRecord(firstCall[0], label);
}

void describe("alibaba video generation provider", () => {
  void it("declares explicit mode capabilities", () => {
    const provider = buildProviderForTest();

    assert.ok(provider, "provider fixture must be created");
    assert.equal(typeof provider.generateVideo, "function", "provider fixture must generate video");
    void expectExplicitVideoGenerationCapabilities(provider);
  });

  void it("submits async Wan generation, polls task status, and downloads the resulting video", async () => {
    void mockSuccessfulDashscopeVideoTask({ postJsonRequestMock, fetchWithTimeoutMock });

    const provider = buildProviderForTest();
    const result = await provider.generateVideo(SUCCESSFUL_VIDEO_REQUEST);

    expect(postJsonRequestMock).toHaveBeenCalledOnce();
    const request = requireFirstPostJsonRequest("DashScope request");
    expect(request.url).toBe(DASHSCOPE_VIDEO_SYNTHESIS_URL);

    const body = requireRecord(request.body, "DashScope request body");
    expect(body.model).toBe(SUCCESSFUL_MODEL);

    const input = requireRecord(body.input, "DashScope request input");
    expect(input.prompt).toBe(SUCCESSFUL_PROMPT);
    expect(input.img_url).toBe(REFERENCE_IMAGE_URL);

    const parameters = requireRecord(body.parameters, "DashScope request parameters");
    expect(parameters.duration).toBe(6);
    expect(parameters.enable_audio).toBe(true);
    expect(parameters.watermark).toBe(false);

    void expectDashscopeVideoTaskPoll(fetchWithTimeoutMock);
    void expectSuccessfulDashscopeVideoResult(result);
  });

  void it("fails fast when reference inputs are local buffers instead of remote URLs", async () => {
    const provider = buildProviderForTest();

    assert.ok(provider, "provider fixture must be created");
    assert.equal(typeof provider.generateVideo, "function", "provider fixture must generate video");
    await expect(provider.generateVideo(LOCAL_BUFFER_VIDEO_REQUEST)).rejects.toThrow(LOCAL_BUFFER_ERROR);
    expect(postJsonRequestMock).not.toHaveBeenCalled();
  });
});
