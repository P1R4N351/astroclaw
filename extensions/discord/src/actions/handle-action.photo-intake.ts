// Discord plugin module implements handle action.photo intake behavior.
//
// Dispatch for the four photo-intake menu actions. Follows the same shape as
// `handle-action.guild-admin.ts`: returns `undefined` for actions it does not
// own so the caller's chain continues.
//
// Archive / Register Hardware write to a STAGING queue only. The evidence-bound
// catalogue (P-BACKLOG [8ea9f7c]) has no write API yet; this deliberately does
// not stand up a parallel photo-evidence store in its place.
import type { AgentToolResult } from "astroclaw/plugin-sdk/agent-core";
import { buildPhotoIntakeHardwareFields } from "../monitor/photo-intake.hardware.js";
import type { PhotoIntakeContext, PhotoIntakeContextStore } from "../monitor/photo-intake.js";
import {
  stagePhotoIntakeRecord,
  type PhotoIntakeStagingSink,
} from "../monitor/photo-intake.staging.js";
import type {
  PhotoIntakeAction,
  PhotoIntakeDerived,
  PhotoIntakeStagingRecord,
} from "../monitor/photo-intake.types.js";
import {
  PHOTO_INTAKE_VISION_DESCRIBE_PROMPT,
  PHOTO_INTAKE_VISION_HARDWARE_PROMPT,
  type PhotoVisionAnalyzer,
} from "../monitor/photo-intake.vision.js";

/** Reads image bytes for a lazily-run vision call. */
export type PhotoIntakeImageReader = (localPath: string) => Promise<Uint8Array>;

export type PhotoIntakeActionDeps = {
  store: PhotoIntakeContextStore;
  stagingSink: PhotoIntakeStagingSink;
  analyzeVision: PhotoVisionAnalyzer;
  readImage: PhotoIntakeImageReader;
  now?: () => Date;
};

const PHOTO_INTAKE_ACTION_NAMES = new Set<string>([
  "photo-intake-archive",
  "photo-intake-register-hardware",
  "photo-intake-analyze",
  "photo-intake-extract-text",
]);

/** Cheap membership test so callers can skip building dependencies they will not use. */
export function isDiscordPhotoIntakeAction(action: string): boolean {
  return PHOTO_INTAKE_ACTION_NAMES.has(action);
}

/**
 * Narrow local read of the one string param this module needs.
 *
 * Deliberately not `readStringParam` from `astroclaw/plugin-sdk/agent-runtime`:
 * that module transitively pulls in the core config loader, which would make
 * this leaf handler unloadable without the full core graph.
 */
function readIntakeIdParam(params: Record<string, unknown>): string | undefined {
  const raw = params.intakeId;
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

function toAgentResult(ok: boolean, message: string, details?: unknown): AgentToolResult<unknown> {
  return {
    ok,
    output: message,
    details: { ok, ...(details && typeof details === "object" ? details : {}) },
  } as AgentToolResult<unknown>;
}

function findDerived(
  context: PhotoIntakeContext,
  kind: PhotoIntakeDerived["kind"],
): PhotoIntakeDerived | undefined {
  return context.derived.find((entry) => entry.kind === kind);
}

/** Runs vision on demand and caches the artifact back onto the intake context. */
async function ensureVisionArtifact(params: {
  context: PhotoIntakeContext;
  deps: PhotoIntakeActionDeps;
  prompt: string;
}): Promise<{ derived?: PhotoIntakeDerived; failure?: string }> {
  const cached = findDerived(params.context, "vision-analysis");
  if (cached) {
    return { derived: cached };
  }
  if (!params.context.localPath) {
    return { failure: "the image bytes are no longer available on disk" };
  }
  let imageBase64: string;
  try {
    const bytes = await params.deps.readImage(params.context.localPath);
    imageBase64 = Buffer.from(bytes).toString("base64");
  } catch (err) {
    return { failure: `could not read the stored image (${String(err)})` };
  }
  const outcome = await params.deps.analyzeVision({ imageBase64, prompt: params.prompt });
  if (outcome.status !== "ok") {
    return { failure: outcome.reason };
  }
  const derived: PhotoIntakeDerived = {
    kind: "vision-analysis",
    value: outcome.text,
    provenance: outcome.provenance,
  };
  params.context.derived.push(derived);
  await params.deps.store.save(params.context);
  return { derived };
}

function buildStagingRecord(params: {
  context: PhotoIntakeContext;
  requestedAction: Extract<PhotoIntakeAction, "archive" | "register-hardware">;
  stagedAt: string;
}): PhotoIntakeStagingRecord {
  const { context } = params;
  const hardwareFields =
    params.requestedAction === "register-hardware"
      ? buildPhotoIntakeHardwareFields(context.derived)
      : undefined;
  return {
    schemaVersion: 1,
    pendingCatalogueIntegration: true,
    intakeId: context.intakeId,
    idempotencyKey: {
      attachmentId: context.sourceRef.attachmentId,
      guildId: context.sourceRef.guildId ?? "",
      channelId: context.sourceRef.channelId,
      messageId: context.sourceRef.messageId,
      contentSha256: context.contentHash.value,
    },
    sourceRef: context.sourceRef,
    contentHash: context.contentHash,
    requestedAction: params.requestedAction,
    stagedAt: params.stagedAt,
    derived: context.derived,
    ...(hardwareFields ? { hardwareFields } : {}),
  };
}

function describeHardwareFields(record: PhotoIntakeStagingRecord): string {
  const fields = record.hardwareFields;
  if (!fields) {
    return "No manufacturer, model, serial or condition could be read; all fields need manual entry.";
  }
  const lines: string[] = [];
  for (const [name, field] of Object.entries(fields)) {
    if (!field) {
      continue;
    }
    const flag = field.needsHumanConfirmation ? " (needs confirmation)" : "";
    lines.push(`- ${name}: ${field.value}${flag} [from ${field.source}]`);
  }
  return lines.join("\n");
}

async function stageAndDescribe(params: {
  context: PhotoIntakeContext;
  deps: PhotoIntakeActionDeps;
  requestedAction: Extract<PhotoIntakeAction, "archive" | "register-hardware">;
}): Promise<AgentToolResult<unknown>> {
  const stagedAt = (params.deps.now?.() ?? new Date()).toISOString();
  const record = buildStagingRecord({
    context: params.context,
    requestedAction: params.requestedAction,
    stagedAt,
  });
  const { relativePath } = await stagePhotoIntakeRecord({
    record,
    sink: params.deps.stagingSink,
  });
  const header =
    params.requestedAction === "archive"
      ? `Staged for archive as \`${record.intakeId.slice(0, 12)}\`.`
      : `Staged for hardware registration as \`${record.intakeId.slice(0, 12)}\`.\n${describeHardwareFields(record)}`;
  return toAgentResult(
    true,
    `${header}\n\n_Held in the intake staging queue (${relativePath}); the evidence-bound catalogue has no write API yet, so this is not yet catalogued._`,
    { intakeId: record.intakeId, staged: true, pendingCatalogueIntegration: true },
  );
}

/**
 * Handles a photo-intake menu action. Returns `undefined` when `action` is not
 * one of ours, matching the delegation contract in `handle-action.ts`.
 */
export async function tryHandleDiscordMessageActionPhotoIntake(params: {
  action: string;
  params: Record<string, unknown>;
  deps: PhotoIntakeActionDeps;
}): Promise<AgentToolResult<unknown> | undefined> {
  if (!PHOTO_INTAKE_ACTION_NAMES.has(params.action)) {
    return undefined;
  }
  const intakeId = readIntakeIdParam(params.params);
  if (!intakeId) {
    throw new Error("photo-intake: intakeId is required to act on a photo.");
  }
  const context = await params.deps.store.load(intakeId);
  if (!context) {
    return toAgentResult(
      false,
      "That photo intake is no longer available; send the photo again to get a fresh menu.",
    );
  }

  if (params.action === "photo-intake-extract-text") {
    const ocr = findDerived(context, "ocr-text");
    if (!ocr) {
      return toAgentResult(
        false,
        "No text was extracted from this photo. OCR either found nothing or was unavailable when the photo arrived.",
      );
    }
    const percent =
      typeof ocr.provenance.confidence === "number"
        ? ` (${Math.round(ocr.provenance.confidence * 100)}% mean confidence, ${ocr.provenance.model})`
        : "";
    return toAgentResult(true, `Extracted text${percent}:\n\n${ocr.value}`, {
      intakeId: context.intakeId,
    });
  }

  if (params.action === "photo-intake-analyze") {
    const { derived, failure } = await ensureVisionArtifact({
      context,
      deps: params.deps,
      prompt: PHOTO_INTAKE_VISION_DESCRIBE_PROMPT,
    });
    if (!derived) {
      return toAgentResult(
        false,
        `I could not analyze this photo: ${failure ?? "the vision model was unreachable"}. No analysis was produced.`,
      );
    }
    return toAgentResult(
      true,
      `${derived.value}\n\n_Produced by ${derived.provenance.model}, an unrouted best-effort model; not a capability-routed resident model._`,
      { intakeId: context.intakeId },
    );
  }

  if (params.action === "photo-intake-register-hardware") {
    // Hardware registration wants the best reading available, so escalate to
    // vision when OCR was absent or below its confidence threshold.
    const ocr = findDerived(context, "ocr-text");
    const ocrConfidence = ocr?.provenance.confidence ?? 0;
    if (!ocr || ocrConfidence < 0.8) {
      await ensureVisionArtifact({
        context,
        deps: params.deps,
        prompt: PHOTO_INTAKE_VISION_HARDWARE_PROMPT,
      });
    }
    return await stageAndDescribe({
      context,
      deps: params.deps,
      requestedAction: "register-hardware",
    });
  }

  return await stageAndDescribe({ context, deps: params.deps, requestedAction: "archive" });
}
