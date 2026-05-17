import type { AstroclawConfig } from "astroclaw/plugin-sdk/config-contracts";
import { inspectDiscordAccount } from "./src/account-inspect.js";

export function inspectDiscordReadOnlyAccount(cfg: AstroclawConfig, accountId?: string | null) {
  return inspectDiscordAccount({ cfg, accountId });
}
