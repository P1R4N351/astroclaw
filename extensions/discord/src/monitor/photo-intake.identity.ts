// Discord plugin module implements photo intake identity behavior.
//
// Content hashing + idempotency-key derivation. There is no sha256 helper on
// any `astroclaw/plugin-sdk/*` subpath, so this mirrors the established
// extension idiom of using `node:crypto` directly (see extensions/beam,
// extensions/memory-wiki).
import { createHash } from "node:crypto";
import type {
  PhotoIntakeContentHash,
  PhotoIntakeIdempotencyKey,
  PhotoIntakeSourceRef,
} from "./photo-intake.types.js";

/** Field separator that cannot occur inside a Discord snowflake or a hex digest. */
const KEY_FIELD_SEPARATOR = "\u0000";

/** Discord snowflakes are numeric strings; reject anything else before hashing. */
function assertKeyComponent(label: string, value: string): void {
  if (typeof value !== "string") {
    throw new TypeError(`photo-intake: ${label} must be a string`);
  }
  if (value.includes(KEY_FIELD_SEPARATOR)) {
    throw new Error(`photo-intake: ${label} must not contain a NUL separator`);
  }
}

export function hashPhotoBytes(bytes: Uint8Array): PhotoIntakeContentHash {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError("photo-intake: bytes must be a Uint8Array");
  }
  return { algo: "sha256", value: createHash("sha256").update(bytes).digest("hex") };
}

/**
 * Builds the idempotency key mandated by the room ruling. `guildId` is absent
 * in DMs and normalizes to the empty string so the key stays total; the empty
 * string is unambiguous because a real snowflake is never empty.
 */
export function buildPhotoIntakeIdempotencyKey(params: {
  sourceRef: PhotoIntakeSourceRef;
  contentHash: PhotoIntakeContentHash;
}): PhotoIntakeIdempotencyKey {
  const { sourceRef, contentHash } = params;
  const key: PhotoIntakeIdempotencyKey = {
    attachmentId: sourceRef.attachmentId,
    guildId: sourceRef.guildId ?? "",
    channelId: sourceRef.channelId,
    messageId: sourceRef.messageId,
    contentSha256: contentHash.value,
  };
  assertKeyComponent("attachmentId", key.attachmentId);
  assertKeyComponent("guildId", key.guildId);
  assertKeyComponent("channelId", key.channelId);
  assertKeyComponent("messageId", key.messageId);
  assertKeyComponent("contentSha256", key.contentSha256);
  if (!key.attachmentId || !key.channelId || !key.messageId || !key.contentSha256) {
    throw new Error("photo-intake: idempotency key requires attachment, channel, message and hash");
  }
  return key;
}

/**
 * Stable catalogue identity for one source item. Field order is fixed and
 * NUL-separated so that no combination of values can collide by concatenation.
 */
export function derivePhotoIntakeId(key: PhotoIntakeIdempotencyKey): string {
  const material = [
    key.attachmentId,
    key.guildId,
    key.channelId,
    key.messageId,
    key.contentSha256,
  ].join(KEY_FIELD_SEPARATOR);
  return createHash("sha256").update(material, "utf8").digest("hex");
}
