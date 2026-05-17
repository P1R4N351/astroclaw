import { VERSION } from "../version.js";
import type { AstroclawConfig } from "./types.astroclaw.js";

export const AUTO_MANAGED_CONFIG_META_FIELDS = {
  lastTouchedVersion: "lastTouchedVersion",
  lastTouchedAt: "lastTouchedAt",
} as const;

export const AUTO_MANAGED_CONFIG_META_PATHS = [
  ["meta", AUTO_MANAGED_CONFIG_META_FIELDS.lastTouchedVersion],
  ["meta", AUTO_MANAGED_CONFIG_META_FIELDS.lastTouchedAt],
] as const;

export function stampConfigWriteMetadata(
  cfg: AstroclawConfig,
  now: string = new Date().toISOString(),
): AstroclawConfig {
  return {
    ...cfg,
    meta: {
      ...cfg.meta,
      [AUTO_MANAGED_CONFIG_META_FIELDS.lastTouchedVersion]: VERSION,
      [AUTO_MANAGED_CONFIG_META_FIELDS.lastTouchedAt]: now,
    },
  };
}
