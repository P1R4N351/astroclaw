import { resolveActiveTalkProviderConfig } from "../../config/talk.js";
import type { AstroclawConfig } from "../../config/types.js";

export { resolveActiveTalkProviderConfig };

export function getRuntimeConfigSnapshot(): AstroclawConfig | null {
  return null;
}
