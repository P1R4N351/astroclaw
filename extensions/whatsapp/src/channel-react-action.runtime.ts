import { readStringOrNumberParam, readStringParam } from "astroclaw/plugin-sdk/channel-actions";
import type { AstroclawConfig } from "astroclaw/plugin-sdk/config-contracts";

export { resolveReactionMessageId } from "astroclaw/plugin-sdk/channel-actions";
export { handleWhatsAppAction } from "./action-runtime.js";
export { isWhatsAppGroupJid, normalizeWhatsAppTarget } from "./normalize.js";
export { readStringOrNumberParam, readStringParam, type AstroclawConfig };
