import { isRecord } from "@astroclaw/normalization-core/record-coerce";

export function readMessageIdempotencyKey(message: unknown): string | null {
  if (!isRecord(message)) {
    return null;
  }
  const value = message.idempotencyKey;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
