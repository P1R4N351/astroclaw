// Discord plugin module implements photo intake vision behavior.
//
// STATUS (verified live against the household mesh, 2026-08-29):
// There is NO production-ready resident multimodal model. `mesh_models`
// returned 89 models and none advertise a vision capability; `route_dry_run`
// with model=vision returned an empty ranked list on all six reachable doors.
// The only vision-tagged model that exists anywhere is
// `Athesus/athesus-vision-reasoning:latest`, pulled on branch-0 only, cold, and
// NOT capability-advertised.
//
// So this module talks to that model DIRECTLY over HTTP as an explicitly
// unrouted, best-effort path. Every result it produces is stamped
// `unrouted: true`. Do not describe this as "the resident model" anywhere.
//
// The `PhotoVisionAnalyzer` port exists so that when a real vision capability
// is registered in the routing layer, swapping in an implementation backed by
// `astroclaw/plugin-sdk/media-understanding` (`describeImageWithModel`, which
// routes through the configured `tools.media.image` model) is a one-line
// substitution at the call site rather than a rewrite here.
import type { PhotoIntakeProvenance } from "./photo-intake.types.js";

/**
 * Branch-0 ollama over the tailnet. Not a routed capability -- a direct
 * endpoint that happens to hold the only vision-tagged model in the household.
 */
export const PHOTO_INTAKE_VISION_ENDPOINT = "http://100.80.69.34:11434/api/generate";

/** The only real vision candidate. Never substitute a guessed name. */
export const PHOTO_INTAKE_VISION_MODEL = "Athesus/athesus-vision-reasoning:latest";

/**
 * One real call measured 111.7s end-to-end on 2026-08-29 -- cold model load plus
 * tailnet transport, which was relaying through Tor at the time. The ceiling has
 * to clear that with headroom or a slow-but-working call reports a false failure.
 * Note the endpoint stopped answering entirely later that same session, so an
 * unreachable branch-0 is the expected case, not the exceptional one.
 */
export const PHOTO_INTAKE_VISION_TIMEOUT_MS = 300_000;

/** Bounds the reply so a runaway generation cannot exhaust the Discord message budget. */
export const PHOTO_INTAKE_VISION_MAX_TOKENS = 400;

export type PhotoVisionOutcome =
  | { status: "ok"; text: string; provenance: PhotoIntakeProvenance }
  | { status: "unavailable"; reason: string };

/** Injectable seam. A future routed implementation satisfies this same port. */
export type PhotoVisionAnalyzer = (params: {
  imageBase64: string;
  prompt: string;
  signal?: AbortSignal;
}) => Promise<PhotoVisionOutcome>;

export const PHOTO_INTAKE_VISION_DESCRIBE_PROMPT =
  "Describe this image in two or three sentences. If it shows hardware, state the manufacturer, model number, and serial number you can read. Say plainly if a field is not legible.";

export const PHOTO_INTAKE_VISION_HARDWARE_PROMPT =
  "This image shows a piece of hardware. Read any manufacturer, model number, serial number, and visible physical condition. Reply with one 'field: value' pair per line, using exactly the field names manufacturer, model, serial, condition. If a field is not legible, write 'unknown'.";

function extractOllamaResponseText(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const response = (payload as { response?: unknown }).response;
  return typeof response === "string" && response.trim() ? response.trim() : undefined;
}

/**
 * Best-effort direct call to branch-0. Never throws and never fabricates: a
 * failure is reported as `unavailable` with the real reason so the Discord
 * surface can say the analysis did not happen.
 */
export function createDirectBranch0VisionAnalyzer(params?: {
  fetchImpl?: typeof fetch;
  endpoint?: string;
  model?: string;
  timeoutMs?: number;
}): PhotoVisionAnalyzer {
  const fetchImpl = params?.fetchImpl ?? globalThis.fetch;
  const endpoint = params?.endpoint ?? PHOTO_INTAKE_VISION_ENDPOINT;
  const model = params?.model ?? PHOTO_INTAKE_VISION_MODEL;
  const timeoutMs = params?.timeoutMs ?? PHOTO_INTAKE_VISION_TIMEOUT_MS;

  return async ({ imageBase64, prompt, signal }) => {
    if (typeof fetchImpl !== "function") {
      return { status: "unavailable", reason: "no fetch implementation available" };
    }
    if (!imageBase64) {
      return { status: "unavailable", reason: "image bytes missing" };
    }
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
    timer.unref?.();
    const composedSignal = signal
      ? AbortSignal.any([signal, timeoutController.signal])
      : timeoutController.signal;
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          images: [imageBase64],
          stream: false,
          options: { num_predict: PHOTO_INTAKE_VISION_MAX_TOKENS },
        }),
        signal: composedSignal,
      });
      if (!response.ok) {
        return {
          status: "unavailable",
          reason: `branch-0 vision endpoint returned HTTP ${response.status}`,
        };
      }
      const text = extractOllamaResponseText(await response.json());
      if (!text) {
        return { status: "unavailable", reason: "branch-0 vision endpoint returned no text" };
      }
      return {
        status: "ok",
        text,
        provenance: {
          engine: "ollama-vision",
          model,
          producedAt: new Date().toISOString(),
          unrouted: true,
          endpoint,
        },
      };
    } catch (err) {
      return { status: "unavailable", reason: `branch-0 vision call failed: ${String(err)}` };
    } finally {
      clearTimeout(timer);
    }
  };
}
