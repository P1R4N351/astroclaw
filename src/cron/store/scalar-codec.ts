import { safeParseJson } from "@astroclaw/normalization-core";
import { isRecord } from "@astroclaw/normalization-core/record-coerce";
/** Normalizes SQLite number/bigint columns into JavaScript numbers. */
export { normalizeSqliteNumber as normalizeNumber } from "../../infra/sqlite-number.js";

export function tryParseJsonObject(raw: string): Record<string, unknown> | undefined {
  const parsed = safeParseJson(raw);
  return isRecord(parsed) ? parsed : undefined;
}
