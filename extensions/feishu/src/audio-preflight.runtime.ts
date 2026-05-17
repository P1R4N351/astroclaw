import { transcribeFirstAudio as transcribeFirstAudioImpl } from "astroclaw/plugin-sdk/media-runtime";

type TranscribeFirstAudio = typeof import("astroclaw/plugin-sdk/media-runtime").transcribeFirstAudio;

export async function transcribeFirstAudio(
  ...args: Parameters<TranscribeFirstAudio>
): ReturnType<TranscribeFirstAudio> {
  return await transcribeFirstAudioImpl(...args);
}
