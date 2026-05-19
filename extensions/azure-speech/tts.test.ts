import assert from "node:assert/strict";
import { installPinnedHostnameTestHooks } from "astroclaw/plugin-sdk/test-env";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  azureSpeechTTS,
  buildAzureSpeechSsml,
  inferAzureSpeechFileExtension,
  isAzureSpeechVoiceCompatible,
  listAzureSpeechVoices,
  normalizeAzureSpeechBaseUrl,
} from "./tts.js";

type FetchCall = readonly [string, RequestInit];

const AZURE_REGION_BASE_URL = "https://eastus.tts.speech.microsoft.com";
const AZURE_TTS_URL = `${AZURE_REGION_BASE_URL}/cognitiveservices/v1`;
const CUSTOM_BASE_URL = "https://custom.example.com";
const VOICES_URL = `${CUSTOM_BASE_URL}/cognitiveservices/voices/list`;
const SPEECH_KEY = "speech-key";
const MP3_BYTES = Buffer.from("mp3");

const EXPECTED_SSML =
  `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" ` +
  `xml:lang="en-US&quot; bad=&quot;1">` +
  `<voice name="en-US-JennyNeural&quot; xml:lang=&quot;evil">` +
  `Tom &amp; "Jerry" &lt;tag&gt;</voice></speak>`;

const VOICES_RESPONSE_BODY = JSON.stringify([
  {
    ShortName: "en-US-JennyNeural",
    DisplayName: "Jenny",
    Locale: "en-US",
    Gender: "Female",
    Status: "GA",
    VoiceTag: { VoicePersonalities: ["Warm"] },
  },
  { ShortName: "en-US-OldNeural", DisplayName: "Old", Status: "Deprecated" },
  { ShortName: "en-US-RetiredNeural", DisplayName: "Retired", IsDeprecated: true },
]);

function requireSingleFetchCall(fetchMock: ReturnType<typeof vi.fn>): FetchCall {
  expect(fetchMock).toHaveBeenCalledOnce();
  assert.equal(fetchMock.mock.calls.length, 1);
  assert.equal(fetchMock.mock.calls[0]?.length, 2);

  const call = fetchMock.mock.calls[0];
  assert.equal(typeof call[0], "string");
  assert.equal(typeof call[1], "object");

  return call as FetchCall;
}

function requireHeaderValue(init: RequestInit, name: string): string {
  assert.ok(init.headers);
  assert.equal(typeof name, "string");

  const headers = new Headers(init.headers);
  const value = headers.get(name);

  assert.ok(value);
  assert.equal(typeof value, "string");

  return value;
}

describe("azure speech tts", () => {
  installPinnedHostnameTestHooks();

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("escapes SSML text and attributes", () => {
    const ssml = buildAzureSpeechSsml({
      text: `Tom & "Jerry" <tag>`,
      voice: `en-US-JennyNeural" xml:lang="evil`,
      lang: `en-US" bad="1`,
    });

    expect(ssml).toBe(EXPECTED_SSML);
    expect(ssml).toContain(`Tom &amp; "Jerry" &lt;tag&gt;`);
  });

  it("normalizes region and endpoint routing", () => {
    const regionUrl = normalizeAzureSpeechBaseUrl({ region: "eastus" });
    const endpointUrl = normalizeAzureSpeechBaseUrl({
      endpoint: `${AZURE_TTS_URL}/`,
    });
    const baseUrl = normalizeAzureSpeechBaseUrl({ baseUrl: `${CUSTOM_BASE_URL}/` });

    expect(regionUrl).toBe(AZURE_REGION_BASE_URL);
    expect(endpointUrl).toBe(AZURE_REGION_BASE_URL);
    expect(baseUrl).toBe(CUSTOM_BASE_URL);
  });

  it("maps Azure output formats to attachment metadata", () => {
    expect(inferAzureSpeechFileExtension("audio-24khz-48kbitrate-mono-mp3")).toBe(".mp3");
    expect(inferAzureSpeechFileExtension("ogg-24khz-16bit-mono-opus")).toBe(".ogg");
    expect(inferAzureSpeechFileExtension("riff-24khz-16bit-mono-pcm")).toBe(".wav");
    expect(inferAzureSpeechFileExtension("raw-8khz-8bit-mono-mulaw")).toBe(".pcm");
    expect(isAzureSpeechVoiceCompatible("ogg-24khz-16bit-mono-opus")).toBe(true);
    expect(isAzureSpeechVoiceCompatible("webm-24khz-16bit-mono-opus")).toBe(false);
  });

  it("posts SSML to the region endpoint with Azure Speech headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(MP3_BYTES, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await azureSpeechTTS({
      text: "hello",
      apiKey: SPEECH_KEY,
      region: "eastus",
      voice: "en-US-JennyNeural",
      lang: "en-US",
      outputFormat: "audio-24khz-48kbitrate-mono-mp3",
      timeoutMs: 1234,
    });

    expect(result).toEqual(MP3_BYTES);

    const [url, init] = requireSingleFetchCall(fetchMock);
    expect(url).toBe(AZURE_TTS_URL);
    expect(init.method).toBe("POST");
    expect(requireHeaderValue(init, "Ocp-Apim-Subscription-Key")).toBe(SPEECH_KEY);
    expect(requireHeaderValue(init, "Content-Type")).toBe("application/ssml+xml");
    expect(requireHeaderValue(init, "X-Microsoft-OutputFormat")).toBe(
      "audio-24khz-48kbitrate-mono-mp3",
    );
    expect(init.body).toContain(`<voice name="en-US-JennyNeural">hello</voice>`);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("lists voices with timeout and filters deprecated entries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(VOICES_RESPONSE_BODY, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const voices = await listAzureSpeechVoices({
      apiKey: SPEECH_KEY,
      baseUrl: CUSTOM_BASE_URL,
      timeoutMs: 4321,
    });

    const [url, init] = requireSingleFetchCall(fetchMock);
    expect(url).toBe(VOICES_URL);
    expect(requireHeaderValue(init, "Ocp-Apim-Subscription-Key")).toBe(SPEECH_KEY);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(voices).toEqual([
      {
        id: "en-US-JennyNeural",
        name: "Jenny",
        description: "Warm",
        locale: "en-US",
        gender: "Female",
        personalities: ["Warm"],
      },
    ]);
  });
});
