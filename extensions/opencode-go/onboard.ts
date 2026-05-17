import {
  applyAgentDefaultModelPrimary,
  type AstroclawConfig,
} from "astroclaw/plugin-sdk/provider-onboard";

export const OPENCODE_GO_DEFAULT_MODEL_REF = "opencode-go/kimi-k2.6";

export function applyOpencodeGoProviderConfig(cfg: AstroclawConfig): AstroclawConfig {
  return cfg;
}

export function applyOpencodeGoConfig(cfg: AstroclawConfig): AstroclawConfig {
  return applyAgentDefaultModelPrimary(
    applyOpencodeGoProviderConfig(cfg),
    OPENCODE_GO_DEFAULT_MODEL_REF,
  );
}
