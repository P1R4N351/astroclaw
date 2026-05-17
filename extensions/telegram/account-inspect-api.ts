import type { AstroclawConfig } from "./runtime-api.js";
import { inspectTelegramAccount } from "./src/account-inspect.js";

export function inspectTelegramReadOnlyAccount(cfg: AstroclawConfig, accountId?: string | null) {
  return inspectTelegramAccount({ cfg, accountId });
}
