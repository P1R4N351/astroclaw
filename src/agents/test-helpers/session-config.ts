import type { AstroclawConfig } from "../../config/types.astroclaw.js";

export function createPerSenderSessionConfig(
  overrides: Partial<NonNullable<AstroclawConfig["session"]>> = {},
): NonNullable<AstroclawConfig["session"]> {
  return {
    mainKey: "main",
    scope: "per-sender",
    ...overrides,
  };
}
