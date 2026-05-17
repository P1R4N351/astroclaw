import { normalizeAstroclawProviderIndex } from "./normalize.js";
import { ASTROCLAW_PROVIDER_INDEX } from "./astroclaw-provider-index.js";
import type { AstroclawProviderIndex } from "./types.js";

export function loadAstroclawProviderIndex(
  source: unknown = ASTROCLAW_PROVIDER_INDEX,
): AstroclawProviderIndex {
  return normalizeAstroclawProviderIndex(source) ?? { version: 1, providers: {} };
}
