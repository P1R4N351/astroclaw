import assert from "node:assert/strict";
import fs from "node:fs";
import { validateJsonSchemaValue } from "astroclaw/plugin-sdk/config-schema";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { __testing } from "../test-api.js";
import { createBraveWebSearchProvider as createBraveWebSearchContractProvider } from "../web-search-contract-api.js";
import { createBraveWebSearchProvider } from "./brave-web-search-provider.js";

const DIAGNOSTIC_LOG_COUNT = 5;
const DOCS_BRAVE_SEARCH_URL = "https://docs.astroclaw.ai/tools/brave-search";
const DOCS_WEB_URL = "https://docs.astroclaw.ai/tools/web";

const loggerInfoMock = vi.hoisted(() => vi.fn());

vi.mock("astroclaw/plugin-sdk/runtime-env", () => ({
  createSubsystemLogger: () => ({
    info: loggerInfoMock,
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    raw: vi.fn(),
    isEnabled: () => true,
    child: () => ({
      info: loggerInfoMock,
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      trace: vi.fn(),
      raw: vi.fn(),
      isEnabled: () => true,
      child: vi.fn(),
    }),
  }),
}));

type FetchMock = {
  readonly mock: {
    readonly calls: ReadonlyArray<ReadonlyArray<unknown>>;
  };
};

type LogPayload = {
  readonly durationMs?: unknown;
  readonly mode?: unknown;
  readonly ok?: unknown;
  readonly status?: unknown;
};

const braveManifest = JSON.parse(
  fs.readFileSync(new URL("../astroclaw.plugin.json", import.meta.url), "utf-8"),
) as {
  readonly configSchema?: Record<string, unknown>;
};

afterAll(() => {
  vi.doUnmock("astroclaw/plugin-sdk/runtime-env");
  vi.resetModules();
});

function fixedAuthValue(): string {
  const value = "fixture-value";
  assert.equal(value.length > 0, true);
  assert.equal(value.includes("\n"), false);
  return value;
}

function makeJsonResponse(body: unknown, status = 200): Response {
  assert.equal(typeof status, "number");
  assert.equal(status >= 100, true);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function makeMalformedJsonResponse(): Response {
  const response = {
    ok: true,
    json: async () => {
      throw new SyntaxError("Unexpected token");
    },
  } as Response;
  assert.equal(response.ok, true);
  assert.equal(typeof response.json, "function");
  return response;
}

function installJsonFetch(body: unknown, status = 200) {
  assert.equal(body === undefined, false);
  assert.equal(status >= 100, true);
  const mockFetch = vi.fn(async (_input?: unknown, _init?: unknown) => makeJsonResponse(body, status));
  global.fetch = mockFetch as typeof global.fetch;
  return mockFetch;
}

function installMalformedJsonFetch() {
  const mockFetch = vi.fn(async (_input?: unknown, _init?: unknown) => makeMalformedJsonResponse());
  global.fetch = mockFetch as typeof global.fetch;
  assert.equal(typeof global.fetch, "function");
  assert.equal(mockFetch.mock.calls.length, 0);
  return mockFetch;
}

function installBraveLlmContextFetch() {
  const body = {
    grounding: {
      generic: [
        {
          url: "https://example.com/context",
          title: "Context",
          snippets: ["snippet"],
        },
      ],
    },
    sources: [],
  };
  const mockFetch = installJsonFetch(body);
  assert.equal(mockFetch.mock.calls.length, 0);
  assert.equal(typeof global.fetch, "function");
  return mockFetch;
}

function readHeader(init: unknown, name: string): string | null {
  assert.equal(typeof name, "string");
  assert.equal(name.length > 0, true);
  const headers = (init as { readonly headers?: HeadersInit } | undefined)?.headers;
  if (!headers) {
    return null;
  }
  // P10-RELAX(rule 3): Headers is required here to validate Fetch-compatible header inputs.
  return new Headers(headers).get(name);
}

function fetchCall(mockFetch: FetchMock, index = 0): ReadonlyArray<unknown> {
  assert.equal(Number.isInteger(index), true);
  assert.equal(index >= 0, true);
  const call = mockFetch.mock.calls[index];
  if (!call) {
    throw new Error(`Expected fetch call ${index + 1}`);
  }
  return call;
}

function fetchRequestUrl(mockFetch: FetchMock, index = 0): URL {
  const call = fetchCall(mockFetch, index);
  assert.equal(call.length >= 1, true);
  assert.equal(typeof call[0], "string");
  // P10-RELAX(rule 3): URL parsing is the API under test and must occur after the request.
  return new URL(call[0]);
}

function fetchRequestInit(mockFetch: FetchMock, index = 0): unknown {
  const call = fetchCall(mockFetch, index);
  assert.equal(call.length >= 1, true);
  assert.equal(index >= 0, true);
  return call[1];
}

function createRequiredTool(options: Parameters<ReturnType<typeof createBraveWebSearchProvider>["createTool"]>[0]) {
  assert.equal(typeof options, "object");
  assert.equal(options !== null, true);
  const provider = createBraveWebSearchProvider();
  const tool = provider.createTool(options);
  if (!tool) {
    throw new Error("Expected tool definition");
  }
  assert.equal(typeof tool.execute, "function");
  return tool;
}

function configSchema(): Record<string, unknown> {
  if (!braveManifest.configSchema) {
    throw new Error("Expected Brave manifest config schema");
  }
  assert.equal(typeof braveManifest.configSchema, "object");
  assert.equal(braveManifest.configSchema !== null, true);
  return braveManifest.configSchema;
}

function assertDiagnosticMessage(index: number, expected: string): void {
  assert.equal(Number.isInteger(index), true);
  assert.equal(expected.length > 0, true);
  expect(loggerInfoMock.mock.calls[index]?.[0]).toBe(expected);
}

function assertDiagnosticPayloadDoesNotExposeAuth(value: unknown, authValue: string): void {
  assert.equal(typeof authValue, "string");
  assert.equal(authValue.length > 0, true);
  expect(value).not.toBe(authValue);
  expect(value).not.toBe("X-Subscription-Token");
}

function expectDiagnosticsDoNotExposeAuth(authValue: string): void {
  assert.equal(loggerInfoMock.mock.calls.length, DIAGNOSTIC_LOG_COUNT);
  assert.equal(authValue.length > 0, true);
  for (let index = 0; index < DIAGNOSTIC_LOG_COUNT; index += 1) {
    const call = loggerInfoMock.mock.calls[index];
    assertDiagnosticPayloadDoesNotExposeAuth(call?.[0], authValue);
    assertDiagnosticPayloadDoesNotExposeAuth(call?.[1], authValue);
  }
}

describe("brave web search provider", () => {
  const priorFetch = global.fetch;

  afterEach(() => {
    vi.unstubAllEnvs();
    loggerInfoMock.mockClear();
    global.fetch = priorFetch;
  });

  describe("metadata and configuration", () => {
    it("points provider metadata at the canonical Brave docs page", () => {
      expect(createBraveWebSearchProvider().docsUrl).toBe(DOCS_BRAVE_SEARCH_URL);
      expect(createBraveWebSearchContractProvider().docsUrl).toBe(DOCS_BRAVE_SEARCH_URL);
    });

    it("exposes legacy top-level apiKey as a Brave-owned compatibility fallback", () => {
      const apiKey = { source: "env", provider: "default", id: "BRAVE_API_KEY" } as const;
      const config = { tools: { web: { search: { apiKey } } } };

      expect(createBraveWebSearchProvider().getConfiguredCredentialValue?.(config)).toEqual(apiKey);
      expect(createBraveWebSearchContractProvider().getConfiguredCredentialValue?.(config)).toEqual(
        apiKey,
      );
      expect(createBraveWebSearchProvider().getConfiguredCredentialFallback?.(config)).toEqual({
        path: "tools.web.search.apiKey",
        value: apiKey,
      });
      expect(createBraveWebSearchContractProvider().getConfiguredCredentialFallback?.(config)).toEqual({
        path: "tools.web.search.apiKey",
        value: apiKey,
      });
    });

    it("points missing-key users to fetch/browser alternatives", async () => {
      vi.stubEnv("BRAVE_API_KEY", "");
      const tool = createRequiredTool({ config: {}, searchConfig: {} });
      const result = await tool.execute({ query: "Astroclaw docs" });

      expect(result).toEqual({
        error: "missing_brave_api_key",
        message:
          "web_search (brave) needs a Brave Search API key. Run `astroclaw configure --section web` to store it, or set BRAVE_API_KEY in the Gateway environment. If you do not want to configure a search API key, use web_fetch for a specific URL or the browser tool for interactive pages.",
        docs: DOCS_WEB_URL,
      });
    });
  });

  describe("normalizers", () => {
    it("normalizes brave language parameters and swaps reversed ui/search inputs", () => {
      expect(__testing.normalizeBraveLanguageParams({ search_lang: "en-US", ui_lang: "ja" })).toEqual({
        search_lang: "jp",
        ui_lang: "en-US",
      });
      expect(__testing.normalizeBraveLanguageParams({ search_lang: "tr-TR", ui_lang: "tr" })).toEqual({
        search_lang: "tr",
        ui_lang: "tr-TR",
      });
      expect(__testing.normalizeBraveLanguageParams({ search_lang: "EN", ui_lang: "en-us" })).toEqual({
        search_lang: "en",
        ui_lang: "en-US",
      });
    });

    it("flags invalid brave language fields", () => {
      expect(__testing.normalizeBraveLanguageParams({ search_lang: "xx" })).toEqual({
        invalidField: "search_lang",
      });
      expect(__testing.normalizeBraveLanguageParams({ search_lang: "en-US" })).toEqual({
        invalidField: "search_lang",
      });
      expect(__testing.normalizeBraveLanguageParams({ ui_lang: "en" })).toEqual({
        invalidField: "ui_lang",
      });
    });

    it("normalizes Brave country codes and falls back unsupported values to ALL", () => {
      expect(__testing.normalizeBraveCountry("de")).toBe("DE");
      expect(__testing.normalizeBraveCountry(" VN ")).toBe("ALL");
      expect(__testing.normalizeBraveCountry("")).toBeUndefined();
    });

    it("defaults brave mode to web unless llm-context is explicitly selected", () => {
      expect(__testing.resolveBraveMode()).toBe("web");
      expect(__testing.resolveBraveMode({ mode: "llm-context" })).toBe("llm-context");
    });
  });

  describe("plugin schema", () => {
    it("accepts llm-context in the Brave plugin config schema", () => {
      const result = validateJsonSchemaValue({
        schema: configSchema(),
        cacheKey: "test:brave-config-schema",
        value: { webSearch: { mode: "llm-context" } },
      });

      expect(result.ok).toBe(true);
    });

    it("accepts baseUrl in the Brave plugin config schema", () => {
      const result = validateJsonSchemaValue({
        schema: configSchema(),
        cacheKey: "test:brave-config-schema-base-url",
        value: { webSearch: { baseUrl: "https://api.search.brave.com/proxy" } },
      });

      expect(result.ok).toBe(true);
    });

    it("rejects invalid Brave mode values in the plugin config schema", () => {
      const result = validateJsonSchemaValue({
        schema: configSchema(),
        cacheKey: "test:brave-config-schema",
        value: { webSearch: { mode: "invalid-mode" } },
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }
      expect(result.errors).toEqual([
        {
          path: "webSearch.mode",
          message: 'must be equal to one of the allowed values (allowed: "web", "llm-context")',
          text: 'webSearch.mode: must be equal to one of the allowed values (allowed: "web", "llm-context")',
          allowedValues: ["web", "llm-context"],
          allowedValuesHiddenCount: 0,
        },
      ]);
    });
  });

  describe("request URLs and parsing errors", () => {
    it("uses configured Brave baseUrl for web search requests", async () => {
      vi.stubEnv("BRAVE_API_KEY", "");
      const mockFetch = installJsonFetch({ web: { results: [] } });
      const tool = createRequiredTool({
        config: {},
        searchConfig: {
          apiKey: fixedAuthValue(),
          brave: { baseUrl: "https://api.search.brave.com/proxy/", mode: "web" },
        },
      });

      await tool.execute({ query: "latest ai news" });

      const requestUrl = fetchRequestUrl(mockFetch);
      expect(requestUrl.origin).toBe("https://api.search.brave.com");
      expect(requestUrl.pathname).toBe("/proxy/res/v1/web/search");
    });

    it("uses configured Brave baseUrl for llm-context requests", async () => {
      vi.stubEnv("BRAVE_API_KEY", "");
      const mockFetch = installBraveLlmContextFetch();
      const tool = createRequiredTool({
        config: {},
        searchConfig: {
          apiKey: fixedAuthValue(),
          brave: { baseUrl: "https://api.search.brave.com/proxy", mode: "llm-context" },
        },
      });

      await tool.execute({ query: "latest ai news" });

      expect(fetchRequestUrl(mockFetch).pathname).toBe("/proxy/res/v1/llm/context");
    });

    it("reports malformed Brave web search JSON as a provider error", async () => {
      vi.stubEnv("BRAVE_API_KEY", "");
      installMalformedJsonFetch();
      const tool = createRequiredTool({
        config: {},
        searchConfig: { apiKey: fixedAuthValue(), brave: { mode: "web" } },
      });

      await expect(tool.execute({ query: "latest ai news" })).rejects.toThrow(
        "Brave Search API error: malformed JSON response",
      );
    });

    it("reports malformed Brave llm-context JSON as a provider error", async () => {
      vi.stubEnv("BRAVE_API_KEY", "");
      installMalformedJsonFetch();
      const tool = createRequiredTool({
        config: {},
        searchConfig: { apiKey: fixedAuthValue(), brave: { mode: "llm-context" } },
      });

      await expect(tool.execute({ query: "latest ai news" })).rejects.toThrow(
        "Brave LLM Context API error: malformed JSON response",
      );
    });
  });

  describe("cache and mapping", () => {
    it("keeps Brave cache entries isolated by baseUrl", async () => {
      vi.stubEnv("BRAVE_API_KEY", "");
      const mockFetch = installJsonFetch({ web: { results: [] } });
      const firstTool = createRequiredTool({
        config: {},
        searchConfig: {
          apiKey: fixedAuthValue(),
          brave: { baseUrl: "https://api.search.brave.com/proxy-one", mode: "web" },
        },
      });
      const secondTool = createRequiredTool({
        config: {},
        searchConfig: {
          apiKey: fixedAuthValue(),
          brave: { baseUrl: "https://api.search.brave.com/proxy-two", mode: "web" },
        },
      });

      await firstTool.execute({ query: "base url cache identity" });
      await secondTool.execute({ query: "base url cache identity" });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(fetchRequestUrl(mockFetch).pathname).toBe("/proxy-one/res/v1/web/search");
      expect(fetchRequestUrl(mockFetch, 1).pathname).toBe("/proxy-two/res/v1/web/search");
    });

    it("maps llm-context results into wrapped source entries", () => {
      expect(
        __testing.mapBraveLlmContextResults({
          grounding: {
            generic: [
              {
                url: "https://example.com/post",
                title: "Example",
                snippets: ["a", "", "b"],
              },
            ],
          },
        }),
      ).toEqual([
        {
          url: "https://example.com/post",
          title: "Example",
          snippets: ["a", "b"],
          siteName: "example.com",
        },
      ]);
    });
  });

  describe("date and country filters", () => {
    it("returns validation errors for invalid date ranges", async () => {
      vi.stubEnv("BRAVE_API_KEY", "");
      const tool = createRequiredTool({
        config: {},
        searchConfig: { apiKey: fixedAuthValue(), brave: { apiKey: fixedAuthValue() } },
      });

      const result = await tool.execute({
        query: "latest gpu news",
        date_after: "2026-03-20",
        date_before: "2026-03-01",
      });

      expect(result).toEqual({
        error: "invalid_date_range",
        message: "date_after must be before date_before.",
        docs: DOCS_WEB_URL,
      });
    });

    it("passes freshness to Brave llm-context endpoint", async () => {
      vi.stubEnv("BRAVE_API_KEY", fixedAuthValue());
      const mockFetch = installBraveLlmContextFetch();
      const tool = createRequiredTool({
        config: {},
        searchConfig: { apiKey: fixedAuthValue(), brave: { mode: "llm-context" } },
      });

      await tool.execute({ query: "latest ai news", freshness: "week" });

      const requestUrl = fetchRequestUrl(mockFetch);
      expect(requestUrl.pathname).toBe("/res/v1/llm/context");
      expect(requestUrl.searchParams.get("freshness")).toBe("pw");
    });

    it("passes bounded date ranges to Brave llm-context endpoint", async () => {
      vi.stubEnv("BRAVE_API_KEY", fixedAuthValue());
      const mockFetch = installBraveLlmContextFetch();
      const tool = createRequiredTool({
        config: {},
        searchConfig: { apiKey: fixedAuthValue(), brave: { mode: "llm-context" } },
      });

      await tool.execute({ query: "latest ai news", date_after: "2025-01-01", date_before: "2025-01-31" });

      const requestUrl = fetchRequestUrl(mockFetch);
      expect(requestUrl.pathname).toBe("/res/v1/llm/context");
      expect(requestUrl.searchParams.get("freshness")).toBe("2025-01-01to2025-01-31");
    });

    it("uses today as the end date for Brave llm-context date_after-only ranges", async () => {
      vi.stubEnv("BRAVE_API_KEY", fixedAuthValue());
      const mockFetch = installBraveLlmContextFetch();
      const tool = createRequiredTool({
        config: {},
        searchConfig: { apiKey: fixedAuthValue(), brave: { mode: "llm-context" } },
      });

      await tool.execute({ query: "latest ai news", date_after: "2025-01-01" });

      // P10-RELAX(rule 3): The test must compare against the provider's current-day behavior.
      const today = new Date().toISOString().slice(0, 10);
      const requestUrl = fetchRequestUrl(mockFetch);
      expect(requestUrl.pathname).toBe("/res/v1/llm/context");
      expect(requestUrl.searchParams.get("freshness")).toBe(`2025-01-01to${today}`);
    });
  });

  describe("filter rejections", () => {
    it("rejects future Brave llm-context date_after-only ranges before fetch", async () => {
      vi.stubEnv("BRAVE_API_KEY", fixedAuthValue());
      const mockFetch = installBraveLlmContextFetch();
      const tool = createRequiredTool({
        config: {},
        searchConfig: { apiKey: fixedAuthValue(), brave: { mode: "llm-context" } },
      });

      const result = await tool.execute({ query: "latest ai news", date_after: "2999-01-01" });

      expect(result).toEqual({
        error: "invalid_date_range",
        message: "date_after cannot be in the future for Brave llm-context mode.",
        docs: DOCS_WEB_URL,
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("rejects Brave llm-context date_before-only ranges before fetch", async () => {
      vi.stubEnv("BRAVE_API_KEY", fixedAuthValue());
      const mockFetch = installBraveLlmContextFetch();
      const tool = createRequiredTool({
        config: {},
        searchConfig: { apiKey: fixedAuthValue(), brave: { mode: "llm-context" } },
      });

      const result = await tool.execute({ query: "latest ai news", date_before: "2025-01-31" });

      expect(result).toEqual({
        error: "unsupported_date_filter",
        message:
          "Brave llm-context mode requires date_after when date_before is set. Use a bounded date range or freshness.",
        docs: DOCS_WEB_URL,
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("falls back unsupported country values before calling Brave", async () => {
      vi.stubEnv("BRAVE_API_KEY", fixedAuthValue());
      const mockFetch = installJsonFetch({ web: { results: [] } });
      const tool = createRequiredTool({
        config: {},
        searchConfig: { apiKey: fixedAuthValue(), brave: { apiKey: fixedAuthValue() } },
      });

      await tool.execute({ query: "latest Vietnam news", country: "VN" });

      expect(fetchRequestUrl(mockFetch).searchParams.get("country")).toBe("ALL");
    });
  });

  describe("authentication and diagnostics", () => {
    it("sends Brave web auth in the X-Subscription-Token header", async () => {
      vi.stubEnv("BRAVE_API_KEY", "");
      const authValue = fixedAuthValue();
      const mockFetch = installJsonFetch({ web: { results: [] } });
      const tool = createRequiredTool({
        config: {},
        searchConfig: { apiKey: authValue, brave: { mode: "web" } },
      });

      await tool.execute({ query: "latest ai news" });

      const requestUrl = fetchRequestUrl(mockFetch);
      expect(requestUrl.searchParams.get("apikey")).toBeNull();
      expect(requestUrl.searchParams.get("key")).toBeNull();
      expect(readHeader(fetchRequestInit(mockFetch), "X-Subscription-Token")).toBe(authValue);
    });

    it("sends Brave llm-context auth in the X-Subscription-Token header", async () => {
      vi.stubEnv("BRAVE_API_KEY", "");
      const authValue = fixedAuthValue();
      const mockFetch = installBraveLlmContextFetch();
      const tool = createRequiredTool({
        config: {},
        searchConfig: { apiKey: authValue, brave: { mode: "llm-context" } },
      });

      await tool.execute({ query: "latest ai news" });

      const requestUrl = fetchRequestUrl(mockFetch);
      expect(requestUrl.searchParams.get("apikey")).toBeNull();
      expect(requestUrl.searchParams.get("key")).toBeNull();
      expect(readHeader(fetchRequestInit(mockFetch), "X-Subscription-Token")).toBe(authValue);
    });

    it("emits brave.http diagnostics for requests, responses, and cache events", async () => {
      vi.stubEnv("BRAVE_API_KEY", "");
      const authValue = fixedAuthValue();
      const mockFetch = installJsonFetch({
        web: {
          results: [
            {
              title: "Diagnostics",
              url: "https://example.com/diagnostics",
              description: "debug details",
            },
          ],
        },
      });
      const tool = createRequiredTool({
        config: { diagnostics: { flags: ["brave.http"] } },
        searchConfig: { apiKey: authValue, brave: { mode: "web" } },
      });

      await tool.execute({ query: "unique brave diagnostics query", count: 1 });
      await tool.execute({ query: "unique brave diagnostics query", count: 1 });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      assertDiagnosticMessage(0, "brave http cache miss");
      assertDiagnosticMessage(1, "brave http request");
      assertDiagnosticMessage(2, "brave http response");
      assertDiagnosticMessage(3, "brave http cache write");
      assertDiagnosticMessage(4, "brave http cache hit");
      expect(loggerInfoMock.mock.calls[1]?.[1]).toEqual({
        mode: "web",
        query: "unique brave diagnostics query",
        params: { count: "1", q: "unique brave diagnostics query" },
        url: "https://api.search.brave.com/res/v1/web/search?q=unique+brave+diagnostics+query&count=1",
      });
      const responsePayload = loggerInfoMock.mock.calls[2]?.[1] as LogPayload | undefined;
      expect(responsePayload?.mode).toBe("web");
      expect(responsePayload?.status).toBe(200);
      expect(responsePayload?.ok).toBe(true);
      expect(typeof responsePayload?.durationMs).toBe("number");
      expect(responsePayload?.durationMs).toBeGreaterThanOrEqual(0);
      expectDiagnosticsDoNotExposeAuth(authValue);
    });
  });
});
