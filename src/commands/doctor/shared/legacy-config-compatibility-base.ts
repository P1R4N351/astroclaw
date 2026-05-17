import type { AstroclawConfig } from "../../../config/types.astroclaw.js";
import {
  normalizeLegacyBrowserConfig,
  normalizeLegacyCrossContextMessageConfig,
  normalizeLegacyMediaProviderOptions,
  normalizeLegacyMistralModelMaxTokens,
  normalizeLegacyOpenAIModelProviderApi,
  normalizeLegacyOllamaNativeNumCtxParams,
  normalizeLegacyRuntimeModelRefs,
  normalizeLegacyNanoBananaSkill,
  normalizeLegacyTalkConfig,
  normalizeMissingGroupVisibleRepliesDefault,
  seedMissingDefaultAccountsFromSingleAccountBase,
} from "./legacy-config-core-normalizers.js";
import { migrateLegacyWebFetchConfig } from "./legacy-web-fetch-migrate.js";
import { migrateLegacyWebSearchConfig } from "./legacy-web-search-migrate.js";
import { migrateLegacyXSearchConfig } from "./legacy-x-search-migrate.js";

export function normalizeBaseCompatibilityConfigValues(
  cfg: AstroclawConfig,
  changes: string[],
  afterBrowser?: (config: AstroclawConfig) => AstroclawConfig,
): AstroclawConfig {
  let next = seedMissingDefaultAccountsFromSingleAccountBase(cfg, changes);
  next = normalizeLegacyBrowserConfig(next, changes);
  next = afterBrowser ? afterBrowser(next) : next;

  for (const migrate of [
    migrateLegacyWebSearchConfig,
    migrateLegacyWebFetchConfig,
    migrateLegacyXSearchConfig,
  ]) {
    const migrated = migrate(next);
    if (migrated.changes.length === 0) {
      continue;
    }
    next = migrated.config;
    changes.push(...migrated.changes);
  }

  next = normalizeLegacyNanoBananaSkill(next, changes);
  next = normalizeLegacyTalkConfig(next, changes);
  next = normalizeLegacyOpenAIModelProviderApi(next, changes);
  next = normalizeLegacyRuntimeModelRefs(next, changes);
  next = normalizeLegacyCrossContextMessageConfig(next, changes);
  next = normalizeMissingGroupVisibleRepliesDefault(next, changes);
  next = normalizeLegacyMediaProviderOptions(next, changes);
  next = normalizeLegacyOllamaNativeNumCtxParams(next, changes);
  return normalizeLegacyMistralModelMaxTokens(next, changes);
}
