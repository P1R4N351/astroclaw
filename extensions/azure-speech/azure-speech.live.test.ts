import assert from "node:assert/strict";
import {
  registerProviderPlugin,
  requireRegisteredProvider,
} from "astroclaw/plugin-sdk/plugin-test-runtime";
import { isLiveTestEnabled } from "astroclaw/plugin-sdk/test-env";
import { describe, expect, it } from "vitest";
import plugin from "./index.js";

const PROVIDER_ID = "azure-speech";
const PROVIDER_NAME = "Azure Speech";
const JENNY_VOICE_ID = "en-US-JennyNeural";
const JENNY_LANG = "en-US";
const LIST_VOICES_TIMEOUT_MS = 120_000;
const SYNTHESIS_TIMEOUT_MS = 90_000;
const SYNTHESIS_TEST_TIMEOUT_MS = 180_000;
const MIN_EXPECTED_VOICES = 100;
const MAX_VOICES_TO_SCAN = 10_000;
const MP3_MIN_BYTES = 512;
const OGG_MIN_BYTES = 128;
const TELEPHONY_MIN_BYTES = 512;
const TEST_CFG = { plugins: { enabled: true } } as never;

const AZURE_SPEECH_KEY =
  process.env.AZURE_SPEECH_KEY?.trim() ??
  process.env.AZURE_SPEECH_API_KEY?.trim() ??
  process.env.SPEECH_KEY?.trim() ??
  "";
const AZURE_SPEECH_REGION =
  process.env.AZURE_SPEECH_REGION?.trim() ?? process.env.SPEECH_REGION?.trim() ?? "";
const LIVE = isLiveTestEnabled() && AZURE_SPEECH_KEY.length > 0 && AZURE_SPEECH_REGION.length > 0;
const describeLive = LIVE ? describe : describe.skip;
const LIVE_PROVIDER_CONFIG = {
  apiKey: AZURE_SPEECH_KEY,
  region: AZURE_SPEECH_REGION,
} as const;
const SYNTHESIS_PROVIDER_CONFIG = {
  apiKey: AZURE_SPEECH_KEY,
  region: AZURE_SPEECH_REGION,
  voice: JENNY_VOICE_ID,
  lang: JENNY_LANG,
} as const;
const AZURE_PLUGIN_REGISTRATION = {
  plugin,
  id: PROVIDER_ID,
  name: PROVIDER_NAME,
} as const;

function requireLiveSpeechConfig(): typeof LIVE_PROVIDER_CONFIG {
  assert.equal(typeof AZURE_SPEECH_KEY, "string");
  assert.equal(typeof AZURE_SPEECH_REGION, "string");
  assert.equal(AZURE_SPEECH_KEY.length > 0, true);
  assert.equal(AZURE_SPEECH_REGION.length > 0, true);
  return LIVE_PROVIDER_CONFIG;
}

function requireSynthesisProviderConfig(): typeof SYNTHESIS_PROVIDER_CONFIG {
  const providerConfig = requireLiveSpeechConfig();
  assert.equal(providerConfig.apiKey.length > 0, true);
  assert.equal(providerConfig.region.length > 0, true);
  assert.equal(SYNTHESIS_PROVIDER_CONFIG.voice, JENNY_VOICE_ID);
  assert.equal(SYNTHESIS_PROVIDER_CONFIG.lang, JENNY_LANG);
  return SYNTHESIS_PROVIDER_CONFIG;
}

function includesVoiceId(
  voices: readonly { readonly id: string }[],
  voiceId: string,
): boolean {
  assert.equal(Array.isArray(voices), true);
  assert.equal(voiceId.length > 0, true);
  assert.equal(voices.length <= MAX_VOICES_TO_SCAN, true);

  for (let index = 0; index < MAX_VOICES_TO_SCAN; index += 1) {
    if (index >= voices.length) {
      return false;
    }

    if (voices[index]?.id === voiceId) {
      return true;
    }
  }

  return false;
}

function registerAzureSpeechPlugin() {
  assert.equal(PROVIDER_ID.length > 0, true);
  assert.equal(PROVIDER_NAME.length > 0, true);
  const registration = registerProviderPlugin(AZURE_PLUGIN_REGISTRATION);
  assert.ok(registration);
  assert.equal(typeof registration, "object");
  return registration;
}

async function requireAzureSpeechProvider() {
  const registered = await registerAzureSpeechPlugin();
  assert.ok(registered);
  assert.equal(typeof registered, "object");
  assert.ok(registered.speechProviders);
  assert.equal(typeof registered.speechProviders, "object");

  const provider = requireRegisteredProvider(registered.speechProviders, PROVIDER_ID);
  assert.ok(provider);
  assert.equal(typeof provider.synthesize, "function");
  return provider;
}

describeLive("azure speech plugin live", () => {
  assert.equal(PROVIDER_ID, "azure-speech");
  assert.equal(PROVIDER_NAME.length > 0, true);

  it("lists voices through the registered speech provider", async () => {
    assert.equal(LIVE, true);
    assert.equal(AZURE_SPEECH_KEY.length > 0, true);

    const provider = await requireAzureSpeechProvider();
    const providerConfig = requireLiveSpeechConfig();
    if (typeof provider.listVoices !== "function") {
      throw new Error("Azure Speech provider does not support voice listing");
    }
    assert.equal(typeof provider.listVoices, "function");
    assert.equal(providerConfig.region.length > 0, true);

    // P10-RELAX(rule 3): The live provider API requires a per-call request object.
    const voices = await provider.listVoices({
      providerConfig,
    });
    assert.ok(voices);
    assert.equal(voices.length <= MAX_VOICES_TO_SCAN, true);

    expect(voices.length).toBeGreaterThan(MIN_EXPECTED_VOICES);
    expect(includesVoiceId(voices, JENNY_VOICE_ID)).toBe(true);
  }, LIST_VOICES_TIMEOUT_MS);

  it("synthesizes MP3, native Ogg/Opus voice notes, and telephony audio", async () => {
    assert.equal(LIVE, true);
    assert.equal(AZURE_SPEECH_REGION.length > 0, true);

    const provider = await requireAzureSpeechProvider();
    const providerConfig = requireSynthesisProviderConfig();
    assert.equal(providerConfig.voice, JENNY_VOICE_ID);
    assert.equal(providerConfig.lang, JENNY_LANG);

    // P10-RELAX(rule 3): The live provider API requires a per-call request object.
    const audioFile = await provider.synthesize({
      text: "Astroclaw Azure Speech text to speech integration test OK.",
      cfg: TEST_CFG,
      providerConfig,
      target: "audio-file",
      timeoutMs: SYNTHESIS_TIMEOUT_MS,
    });

    expect(audioFile.outputFormat).toBe("audio-24khz-48kbitrate-mono-mp3");
    expect(audioFile.fileExtension).toBe(".mp3");
    expect(audioFile.voiceCompatible).toBe(false);
    expect(audioFile.audioBuffer.byteLength).toBeGreaterThan(MP3_MIN_BYTES);

    // P10-RELAX(rule 3): The live provider API requires a per-call request object.
    const voiceNote = await provider.synthesize({
      text: "Astroclaw Azure Speech voice note integration test OK.",
      cfg: TEST_CFG,
      providerConfig,
      target: "voice-note",
      timeoutMs: SYNTHESIS_TIMEOUT_MS,
    });

    expect(voiceNote.outputFormat).toBe("ogg-24khz-16bit-mono-opus");
    expect(voiceNote.fileExtension).toBe(".ogg");
    expect(voiceNote.voiceCompatible).toBe(true);
    expect(voiceNote.audioBuffer.byteLength).toBeGreaterThan(OGG_MIN_BYTES);
    expect(voiceNote.audioBuffer.subarray(0, 4).toString("ascii")).toBe("OggS");

    if (typeof provider.synthesizeTelephony !== "function") {
      throw new Error("Azure Speech provider does not support telephony synthesis");
    }
    assert.equal(typeof provider.synthesizeTelephony, "function");
    assert.equal(providerConfig.apiKey.length > 0, true);

    // P10-RELAX(rule 3): The live provider API requires a per-call request object.
    const telephony = await provider.synthesizeTelephony({
      text: "Astroclaw Azure Speech telephony check OK.",
      cfg: TEST_CFG,
      providerConfig,
      timeoutMs: SYNTHESIS_TIMEOUT_MS,
    });
    assert.ok(telephony);
    assert.equal(telephony.sampleRate, 8_000);

    expect(telephony.outputFormat).toBe("raw-8khz-8bit-mono-mulaw");
    expect(telephony.sampleRate).toBe(8_000);
    expect(telephony.audioBuffer.byteLength).toBeGreaterThan(TELEPHONY_MIN_BYTES);
  }, SYNTHESIS_TEST_TIMEOUT_MS);
});
