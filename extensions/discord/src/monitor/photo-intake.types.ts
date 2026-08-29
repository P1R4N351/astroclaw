// Discord type declarations define photo intake contracts.
//
// Shape mandated by the `multimodality` room ruling (2026-08-29): one
// physical/source item -> one catalogue identity -> many derived records.
// Derived artifacts never become a second parallel photo-evidence store; they
// hang off a single `source_ref` + `content_hash` identity so that draining
// this staging queue into the evidence-bound catalogue (P-BACKLOG [8ea9f7c])
// is a read-and-upsert rather than a rebuild.

/** Actions offered to the operator when a photo lands in Discord. */
export type PhotoIntakeAction = "archive" | "register-hardware" | "analyze-photo" | "extract-text";

export const PHOTO_INTAKE_ACTIONS: readonly PhotoIntakeAction[] = [
  "archive",
  "register-hardware",
  "analyze-photo",
  "extract-text",
] as const;

/**
 * Discord-side provenance for one attachment. Every field is captured at
 * intake time because Discord CDN URLs expire and cannot be re-derived later.
 */
export type PhotoIntakeSourceRef = {
  provider: "discord";
  attachmentId: string;
  /** Absent for direct messages; normalized to undefined rather than a sentinel. */
  guildId?: string;
  channelId: string;
  messageId: string;
  authorId: string;
  fileName?: string;
  contentType?: string;
  byteSize: number;
  observedAt: string;
};

/** Content-addressed identity of the attachment bytes. */
export type PhotoIntakeContentHash = {
  algo: "sha256";
  value: string;
};

/**
 * Idempotency key required by the room ruling: the Discord coordinates plus the
 * content hash. Re-sending the same bytes in the same message must collapse to
 * one catalogue identity.
 */
export type PhotoIntakeIdempotencyKey = {
  attachmentId: string;
  guildId: string;
  channelId: string;
  messageId: string;
  contentSha256: string;
};

/** Which engine produced a derived artifact, and whether it can be trusted. */
export type PhotoIntakeProvenance = {
  engine: "tesseract" | "ollama-vision";
  /** Model or binary identifier. Never a guessed name. */
  model: string;
  producedAt: string;
  /** 0..1. Absent when the engine reports no confidence signal. */
  confidence?: number;
  /**
   * True when the engine was reached outside the household capability-routing
   * layer. As of 2026-08-29 no vision capability is registered in routing at
   * all, so every vision artifact is unrouted best-effort.
   */
  unrouted?: boolean;
  /** Endpoint actually contacted, for audit. */
  endpoint?: string;
};

export type PhotoIntakeDerivedKind = "ocr-text" | "vision-analysis";

export type PhotoIntakeDerived = {
  kind: PhotoIntakeDerivedKind;
  value: string;
  provenance: PhotoIntakeProvenance;
};

/**
 * A field parsed out of OCR/vision output for hardware registration. Uncertain
 * fields are marked for human confirmation rather than asserted.
 */
export type PhotoIntakeHardwareField = {
  value: string;
  source: PhotoIntakeDerivedKind;
  needsHumanConfirmation: boolean;
};

export type PhotoIntakeHardwareFields = {
  manufacturer?: PhotoIntakeHardwareField;
  model?: PhotoIntakeHardwareField;
  serial?: PhotoIntakeHardwareField;
  condition?: PhotoIntakeHardwareField;
};

/** One append-only staging record awaiting catalogue integration. */
export type PhotoIntakeStagingRecord = {
  schemaVersion: 1;
  /** Always true in this queue: nothing here has reached the real catalogue. */
  pendingCatalogueIntegration: true;
  /** sha256 over the idempotency key material; the catalogue identity. */
  intakeId: string;
  idempotencyKey: PhotoIntakeIdempotencyKey;
  sourceRef: PhotoIntakeSourceRef;
  contentHash: PhotoIntakeContentHash;
  requestedAction: Extract<PhotoIntakeAction, "archive" | "register-hardware">;
  stagedAt: string;
  derived: PhotoIntakeDerived[];
  hardwareFields?: PhotoIntakeHardwareFields;
};
