import type { AstroclawConfig } from "../../config/types.astroclaw.js";

export function makeModelFallbackCfg(overrides: Partial<AstroclawConfig> = {}): AstroclawConfig {
  return {
    agents: {
      defaults: {
        model: {
          primary: "openai/gpt-4.1-mini",
          fallbacks: ["anthropic/claude-haiku-3-5"],
        },
      },
    },
    ...overrides,
  } as AstroclawConfig;
}
