// Discord tests cover photo intake vision plugin behavior.
import { describe, expect, it, vi } from "vitest";
import {
  PHOTO_INTAKE_VISION_MODEL,
  createDirectBranch0VisionAnalyzer,
} from "./photo-intake.vision.js";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("createDirectBranch0VisionAnalyzer", () => {
  it("posts the image to the configured endpoint and returns the model text", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ response: "  A network switch label.  " }));
    const analyze = createDirectBranch0VisionAnalyzer({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      endpoint: "http://example.invalid/api/generate",
    });
    const outcome = await analyze({ imageBase64: "AAAA", prompt: "describe" });

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") {
      return;
    }
    expect(outcome.text).toBe("A network switch label.");
    expect(outcome.provenance.model).toBe(PHOTO_INTAKE_VISION_MODEL);
    // The whole point of the flag: nothing downstream may present this as routed.
    expect(outcome.provenance.unrouted).toBe(true);
    expect(outcome.provenance.engine).toBe("ollama-vision");

    const [, init] = fetchImpl.mock.calls[0] ?? [];
    const body = JSON.parse(String((init as RequestInit).body)) as {
      model: string;
      images: string[];
      stream: boolean;
    };
    expect(body.model).toBe(PHOTO_INTAKE_VISION_MODEL);
    expect(body.images).toEqual(["AAAA"]);
    expect(body.stream).toBe(false);
  });

  it("degrades to unavailable on a non-2xx response rather than inventing an analysis", async () => {
    const analyze = createDirectBranch0VisionAnalyzer({
      fetchImpl: (async () => jsonResponse({}, 503)) as unknown as typeof fetch,
    });
    const outcome = await analyze({ imageBase64: "AAAA", prompt: "describe" });
    expect(outcome.status).toBe("unavailable");
    if (outcome.status !== "unavailable") {
      return;
    }
    expect(outcome.reason).toContain("503");
  });

  it("degrades to unavailable when the endpoint is unreachable", async () => {
    const analyze = createDirectBranch0VisionAnalyzer({
      fetchImpl: (async () => {
        throw new Error("ECONNREFUSED");
      }) as unknown as typeof fetch,
    });
    const outcome = await analyze({ imageBase64: "AAAA", prompt: "describe" });
    expect(outcome.status).toBe("unavailable");
    if (outcome.status !== "unavailable") {
      return;
    }
    expect(outcome.reason).toContain("ECONNREFUSED");
  });

  it("treats an empty generation as unavailable, not as an empty analysis", async () => {
    const analyze = createDirectBranch0VisionAnalyzer({
      fetchImpl: (async () => jsonResponse({ response: "   " })) as unknown as typeof fetch,
    });
    const outcome = await analyze({ imageBase64: "AAAA", prompt: "describe" });
    expect(outcome.status).toBe("unavailable");
  });

  it("refuses to call the endpoint without image bytes", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ response: "x" }));
    const analyze = createDirectBranch0VisionAnalyzer({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const outcome = await analyze({ imageBase64: "", prompt: "describe" });
    expect(outcome.status).toBe("unavailable");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
