// Discord plugin module implements photo intake behavior.
//
// Orchestration seam: detects an inbound image attachment, captures provenance,
// runs local OCR, and produces the action menu. Per the `multimodality` room
// ruling this module owns the attachment -> action-menu flow; the existing
// component builders remain a pure view layer and are never reimplemented here.
//
// EAGER/LAZY SPLIT (measured on this host, 2026-08-29):
//   OCR    tesseract 5.5.0, 600x220 label fixture, local ......... 0.24s -> EAGER
//   Vision Athesus/athesus-vision-reasoning on branch-0, one call  111.7s -> LAZY
// The vision figure is END-TO-END WALL CLOCK over the tailnet, which was
// routing to branch-0 through a Tor relay that day, so it is transport plus
// cold model load, not a clean inference benchmark. The split does not depend
// on the exact ratio: OCR is local and sub-second, vision is remote, minutes
// long, and INTERMITTENTLY UNREACHABLE (the same endpoint stopped answering
// entirely later the same session). Paying that on every inbound photo, for
// photos the operator may only want archived, is indefensible -- so vision runs
// only when "Analyze Photo" is pressed, and OCR's confidence is what decides
// whether escalating to vision is even worth offering.
import type { DiscordComponentMessageSpec } from "../components.types.js";
import {
  buildPhotoIntakeIdempotencyKey,
  derivePhotoIntakeId,
  hashPhotoBytes,
} from "./photo-intake.identity.js";
import { buildPhotoIntakeMenuSpec } from "./photo-intake.menu.js";
import type { PhotoIntakeOcrOutcome } from "./photo-intake.ocr.js";
import { runPhotoIntakeOcr, type OcrCommandRunner } from "./photo-intake.ocr.js";
import type {
  PhotoIntakeContentHash,
  PhotoIntakeDerived,
  PhotoIntakeSourceRef,
} from "./photo-intake.types.js";
import { PHOTO_INTAKE_VISION_MODEL } from "./photo-intake.vision.js";

/** Upper bound on attachments handled per message; a flood cannot fan out unbounded. */
export const MAX_PHOTO_INTAKE_ATTACHMENTS_PER_MESSAGE = 4;

/** Narrow input shape so this module does not depend on the Discord API types. */
export type PhotoIntakeAttachmentInput = {
  attachmentId: string;
  fileName?: string;
  contentType?: string;
  byteSize: number;
  /** Local path of the already-downloaded attachment. */
  localPath?: string;
};

export type PhotoIntakeMessageInput = {
  guildId?: string;
  channelId: string;
  messageId: string;
  authorId: string;
};

/** Everything a later button press needs to act without re-downloading. */
export type PhotoIntakeContext = {
  intakeId: string;
  sourceRef: PhotoIntakeSourceRef;
  contentHash: PhotoIntakeContentHash;
  localPath?: string;
  derived: PhotoIntakeDerived[];
};

export type PhotoIntakeContextStore = {
  save: (context: PhotoIntakeContext) => Promise<void>;
  load: (intakeId: string) => Promise<PhotoIntakeContext | undefined>;
};

const IMAGE_FILE_EXTENSION = /\.(avif|bmp|gif|heic|heif|jpe?g|png|tiff?|webp)$/i;

/** Mirrors the classification `message-media.ts` already applies to attachments. */
export function isPhotoIntakeCandidate(attachment: PhotoIntakeAttachmentInput): boolean {
  if (attachment.contentType?.toLowerCase().startsWith("image/")) {
    return true;
  }
  return IMAGE_FILE_EXTENSION.test(attachment.fileName ?? "");
}

function toOcrDerived(outcome: PhotoIntakeOcrOutcome): PhotoIntakeDerived | undefined {
  if (outcome.status !== "ok" || !outcome.text) {
    return undefined;
  }
  return {
    kind: "ocr-text",
    value: outcome.text,
    provenance: {
      engine: "tesseract",
      model: outcome.engineVersion,
      producedAt: new Date().toISOString(),
      confidence: outcome.confidence,
    },
  };
}

export type PreparedPhotoIntake = {
  context: PhotoIntakeContext;
  menu: DiscordComponentMessageSpec;
  ocr: PhotoIntakeOcrOutcome;
};

/**
 * Prepares one attachment: provenance, content hash, eager OCR, action menu.
 * Throws only on programmer error; an unusable OCR binary is a reported status,
 * never a thrown failure, because a photo must still be archivable without OCR.
 */
export async function prepareDiscordPhotoIntake(params: {
  attachment: PhotoIntakeAttachmentInput;
  message: PhotoIntakeMessageInput;
  bytes: Uint8Array;
  store: PhotoIntakeContextStore;
  observedAt?: string;
  runOcrCommand?: OcrCommandRunner;
  allowedUsers?: string[];
}): Promise<PreparedPhotoIntake> {
  const { attachment, message, bytes } = params;
  if (!attachment.attachmentId) {
    throw new Error("photo-intake: attachment id is required");
  }
  const sourceRef: PhotoIntakeSourceRef = {
    provider: "discord",
    attachmentId: attachment.attachmentId,
    ...(message.guildId ? { guildId: message.guildId } : {}),
    channelId: message.channelId,
    messageId: message.messageId,
    authorId: message.authorId,
    ...(attachment.fileName ? { fileName: attachment.fileName } : {}),
    ...(attachment.contentType ? { contentType: attachment.contentType } : {}),
    byteSize: attachment.byteSize,
    observedAt: params.observedAt ?? new Date().toISOString(),
  };
  const contentHash = hashPhotoBytes(bytes);
  const idempotencyKey = buildPhotoIntakeIdempotencyKey({ sourceRef, contentHash });
  const intakeId = derivePhotoIntakeId(idempotencyKey);

  const ocr: PhotoIntakeOcrOutcome = attachment.localPath
    ? await runPhotoIntakeOcr({
        imagePath: attachment.localPath,
        ...(params.runOcrCommand ? { runCommand: params.runOcrCommand } : {}),
      })
    : { status: "unavailable", reason: "attachment bytes were not saved to a local path" };

  const derivedOcr = toOcrDerived(ocr);
  const context: PhotoIntakeContext = {
    intakeId,
    sourceRef,
    contentHash,
    ...(attachment.localPath ? { localPath: attachment.localPath } : {}),
    derived: derivedOcr ? [derivedOcr] : [],
  };
  await params.store.save(context);

  const menu = buildPhotoIntakeMenuSpec({
    intakeId,
    ...(attachment.fileName ? { fileName: attachment.fileName } : {}),
    ocrAvailable: ocr.status === "ok",
    ocrWordCount: ocr.status === "ok" ? ocr.wordCount : 0,
    ...(ocr.status === "ok" ? { ocrConfidence: ocr.confidence } : {}),
    ...(ocr.status === "ok" ? {} : { ocrUnavailableReason: ocr.reason }),
    visionModelLabel: PHOTO_INTAKE_VISION_MODEL,
    ...(params.allowedUsers ? { allowedUsers: params.allowedUsers } : {}),
  });

  return { context, menu, ocr };
}
