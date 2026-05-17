import type { AstroclawConfig } from "astroclaw/plugin-sdk/config-contracts";
import { inspectSlackAccount } from "./src/account-inspect.js";

export function inspectSlackReadOnlyAccount(cfg: AstroclawConfig, accountId?: string | null) {
  return inspectSlackAccount({ cfg, accountId });
}
