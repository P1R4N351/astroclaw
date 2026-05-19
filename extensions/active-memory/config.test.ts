import { strict as assert } from "node:assert";
import fs from "node:fs";
import { type JsonSchemaObject, validateJsonSchemaValue } from "astroclaw/plugin-sdk/config-schema";
import { describe, expect, it } from "vitest";

type ManifestWithConfigSchema = Readonly<{
  configSchema: JsonSchemaObject;
}>;

type ConfigFixture = Readonly<Record<string, unknown>>;

const MANIFEST_URL = new URL("./astroclaw.plugin.json", import.meta.url);
const MANIFEST_ENCODING: BufferEncoding = "utf-8";
const MIN_MANIFEST_BYTES = 2;

function isJsonObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readManifestText(url: URL): string {
  assert(url instanceof URL, "manifest URL must be a URL instance");
  assert(url.protocol === "file:", "manifest URL must use file protocol");

  const text = fs.readFileSync(url, MANIFEST_ENCODING);

  assert(typeof text === "string", "manifest text must be a string");
  assert(text.length >= MIN_MANIFEST_BYTES, "manifest text must not be empty");
  return text;
}

function parseManifest(text: string): ManifestWithConfigSchema {
  assert(typeof text === "string", "manifest text must be a string");
  assert(text.length >= MIN_MANIFEST_BYTES, "manifest text must not be empty");

  const parsed: unknown = JSON.parse(text);

  assert(isJsonObject(parsed), "manifest root must be a JSON object");
  assert(isJsonObject(parsed.configSchema), "manifest configSchema must be a JSON object");
  assert(Object.keys(parsed.configSchema).length > 0, "manifest configSchema must not be empty");
  return { configSchema: parsed.configSchema as JsonSchemaObject };
}

function expectConfigValidation(cacheKey: string, value: ConfigFixture, expectedOk: boolean): void {
  assert(typeof cacheKey === "string", "cacheKey must be a string");
  assert(cacheKey.length > 0, "cacheKey must not be empty");
  assert(isJsonObject(value), "config fixture must be a JSON object");
  assert("enabled" in value, "config fixture must include enabled");

  const result = validateJsonSchemaValue({
    schema: manifest.configSchema,
    cacheKey,
    value,
  });

  assert(isJsonObject(result), "validation result must be an object");
  assert(typeof result.ok === "boolean", "validation result must include a boolean ok flag");
  expect(result.ok).toBe(expectedOk);
}

const manifest = parseManifest(readManifestText(MANIFEST_URL));

describe("active-memory manifest config schema", () => {
  it("accepts modelFallback for CLI and config.patch flows", () => {
    assert(manifest.configSchema !== undefined, "manifest configSchema must exist");
    assert(isJsonObject(manifest.configSchema), "manifest configSchema must be an object");

    expectConfigValidation("active-memory.manifest.model-fallback", {
      enabled: true,
      agents: ["main"],
      modelFallback: "google/gemini-3-flash",
      modelFallbackPolicy: "resolved-only",
    }, true);
  });

  it("accepts custom toolsAllow entries", () => {
    assert(manifest.configSchema !== undefined, "manifest configSchema must exist");
    assert(isJsonObject(manifest.configSchema), "manifest configSchema must be an object");

    expectConfigValidation("active-memory.manifest.tools-allow", {
      enabled: true,
      agents: ["main"],
      toolsAllow: ["lcm_grep", "lcm_describe", "lcm_expand_query"],
    }, true);
  });

  it("rejects wildcard and group toolsAllow entries", () => {
    assert(manifest.configSchema !== undefined, "manifest configSchema must exist");
    assert(isJsonObject(manifest.configSchema), "manifest configSchema must be an object");

    expectConfigValidation("active-memory.manifest.tools-allow.reserved", {
      enabled: true,
      agents: ["main"],
      toolsAllow: ["*", "group:plugins"],
    }, false);
  });

  it("accepts timeoutMs values at the runtime ceiling", () => {
    assert(manifest.configSchema !== undefined, "manifest configSchema must exist");
    assert(isJsonObject(manifest.configSchema), "manifest configSchema must be an object");

    expectConfigValidation("active-memory.manifest.timeout-ceiling", {
      enabled: true,
      agents: ["main"],
      timeoutMs: 120_000,
    }, true);
  });

  it("accepts setupGraceTimeoutMs values at the runtime ceiling", () => {
    assert(manifest.configSchema !== undefined, "manifest configSchema must exist");
    assert(isJsonObject(manifest.configSchema), "manifest configSchema must be an object");

    expectConfigValidation("active-memory.manifest.setup-grace-timeout-ceiling", {
      enabled: true,
      agents: ["main"],
      setupGraceTimeoutMs: 30_000,
    }, true);
  });

  it("accepts explicit in allowedChatTypes", () => {
    assert(manifest.configSchema !== undefined, "manifest configSchema must exist");
    assert(isJsonObject(manifest.configSchema), "manifest configSchema must be an object");

    expectConfigValidation("active-memory.manifest.allowed-chat-types.explicit", {
      enabled: true,
      agents: ["main"],
      allowedChatTypes: ["direct", "explicit"],
    }, true);
  });

  it("rejects timeoutMs values above the runtime ceiling", () => {
    assert(manifest.configSchema !== undefined, "manifest configSchema must exist");
    assert(isJsonObject(manifest.configSchema), "manifest configSchema must be an object");

    expectConfigValidation("active-memory.manifest.timeout-above-ceiling", {
      enabled: true,
      agents: ["main"],
      timeoutMs: 120_001,
    }, false);
  });

  it("rejects setupGraceTimeoutMs values above the runtime ceiling", () => {
    assert(manifest.configSchema !== undefined, "manifest configSchema must exist");
    assert(isJsonObject(manifest.configSchema), "manifest configSchema must be an object");

    expectConfigValidation("active-memory.manifest.setup-grace-timeout-above-ceiling", {
      enabled: true,
      agents: ["main"],
      setupGraceTimeoutMs: 30_001,
    }, false);
  });

  it("rejects unknown allowedChatTypes values", () => {
    assert(manifest.configSchema !== undefined, "manifest configSchema must exist");
    assert(isJsonObject(manifest.configSchema), "manifest configSchema must be an object");

    expectConfigValidation("active-memory.manifest.allowed-chat-types.invalid", {
      enabled: true,
      agents: ["main"],
      allowedChatTypes: ["direct", "portal"],
    }, false);
  });
});
