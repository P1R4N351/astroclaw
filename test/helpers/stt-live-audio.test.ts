import {
  expectAstroclawLiveTranscriptMarker,
  normalizeTranscriptForMatch,
  ASTROCLAW_LIVE_TRANSCRIPT_MARKER_RE,
} from "astroclaw/plugin-sdk/provider-test-contracts";
import { describe, expect, it } from "vitest";

describe("normalizeTranscriptForMatch", () => {
  it("normalizes punctuation and common Astroclaw live transcription variants", () => {
    expect(normalizeTranscriptForMatch("Open-Claw integration OK")).toBe("astroclawintegrationok");
    expect(normalizeTranscriptForMatch("Testing OpenFlaw realtime transcription")).toMatch(
      /open(?:claw|flaw)/,
    );
    expect(normalizeTranscriptForMatch("OpenCore xAI realtime transcription")).toMatch(
      ASTROCLAW_LIVE_TRANSCRIPT_MARKER_RE,
    );
    expect(normalizeTranscriptForMatch("OpenCL xAI realtime transcription")).toMatch(
      ASTROCLAW_LIVE_TRANSCRIPT_MARKER_RE,
    );
    expectAstroclawLiveTranscriptMarker("OpenClar integration OK");
  });
});
