import { parseStrictPositiveInteger } from "@astroclaw/normalization-core/number-coercion";

export function parsePositiveInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return typeof value === "string" ? parseStrictPositiveInteger(value) : undefined;
}
