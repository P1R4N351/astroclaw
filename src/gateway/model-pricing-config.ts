import type { AstroclawConfig } from "../config/types.astroclaw.js";

export function isGatewayModelPricingEnabled(config: AstroclawConfig): boolean {
  return config.models?.pricing?.enabled !== false;
}
