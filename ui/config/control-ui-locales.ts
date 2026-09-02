import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import {
  loadControlUiSourceCatalog,
  loadControlUiTranslationMemory,
  materializeControlUiLocaleCatalog,
} from "../../scripts/lib/control-ui-i18n-catalog.ts";
import { CONTROL_UI_LOCALE_ENTRIES } from "../../scripts/lib/control-ui-i18n-config.ts";
import { flattenTranslations } from "../../scripts/lib/control-ui-i18n-sync-plan.ts";

const localeModulePrefix = "virtual:openclaw-control-ui-locale/";
const resolvedLocaleModulePrefix = `\0${localeModulePrefix}`;
// Vitest rewrites new URL(relative, import.meta.url) to browser self.location.
const i18nAssetsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/i18n/.i18n",
);
const locales = new Set(CONTROL_UI_LOCALE_ENTRIES.map(({ locale }) => locale));
// Mirrors scripts/control-ui-i18n.ts's SOURCE_LOCALE_PATH/ACTIVITY_SOURCE_LOCALE_PATH/
// SESSION_PLACEMENT_SOURCE_LOCALE_PATH/PLUGIN_CONSENT_SOURCE_LOCALE_PATH -- this call site
// had drifted to the zero-arg call the function used to take, throwing
// ERR_INVALID_ARG_TYPE out of fs.promises.stat(undefined) the moment any vitest config
// (even a non-UI one, via the shared workspace glob) touched this module.
const controlUiLocalesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/i18n/locales",
);
const sourceCatalog = await loadControlUiSourceCatalog(
  path.join(controlUiLocalesDir, "en.ts"),
  path.join(controlUiLocalesDir, "en-activity.ts"),
  path.join(controlUiLocalesDir, "en-session-placement.ts"),
  path.join(controlUiLocalesDir, "en-plugin-consent.ts"),
);

export function controlUiLocaleModulesPlugin(): Plugin {
  return {
    name: "control-ui-locale-modules",
    enforce: "pre",
    resolveId(id) {
      if (id.startsWith(localeModulePrefix) && locales.has(id.slice(localeModulePrefix.length))) {
        return `\0${id}`;
      }
      return null;
    },
    load(id) {
      if (!id.startsWith(resolvedLocaleModulePrefix)) {
        return null;
      }
      const locale = id.slice(resolvedLocaleModulePrefix.length);
      if (!locales.has(locale)) {
        return null;
      }
      const memoryPath = path.join(i18nAssetsDir, `${locale}.tm.jsonl`);
      // Source PRs omit generated memory until the post-merge refresh runs.
      // Existing empty or malformed memory stays fatal below so drift cannot hide.
      if (!existsSync(memoryPath)) {
        return `export default ${JSON.stringify(sourceCatalog)};`;
      }
      this.addWatchFile(memoryPath);
      const memory = loadControlUiTranslationMemory(memoryPath);
      if (memory.size === 0) {
        throw new Error(`Control UI ${locale} translation memory is missing or empty`);
      }
      const catalog = materializeControlUiLocaleCatalog(flattenTranslations(sourceCatalog), memory);
      return `export default ${JSON.stringify(catalog)};`;
    },
  };
}
