// Canonical (and legacy) bundled-plugin manifest filenames.
//
// The 2026-05-17 substrate rebrand renamed every `extensions/*/openclaw.plugin.json`
// to `astroclaw.plugin.json`, but the build pipeline kept the old literal hardcoded in
// ~20 places. The result was silent: plugin discovery matched zero files, so staging,
// publication and facade activation became no-ops instead of failing loudly.
//
// Readers accept BOTH names (astroclaw first) so that legacy plugin packages and the
// existing test fixtures that still author `openclaw.plugin.json` keep resolving.
// Writers should always emit PLUGIN_MANIFEST_FILENAME.
import fs from "node:fs";
import path from "node:path";

/** Canonical plugin manifest filename inside plugin roots. */
export const PLUGIN_MANIFEST_FILENAME = "astroclaw.plugin.json";

/** Pre-rebrand manifest filename, still accepted when reading. */
export const LEGACY_PLUGIN_MANIFEST_FILENAME = "openclaw.plugin.json";

/** Every manifest filename a reader must accept, most-canonical first. */
export const PLUGIN_MANIFEST_FILENAMES = Object.freeze([
  PLUGIN_MANIFEST_FILENAME,
  LEGACY_PLUGIN_MANIFEST_FILENAME,
]);

/** True when `name` is one of the accepted plugin manifest basenames. */
export function isPluginManifestFilename(name) {
  return PLUGIN_MANIFEST_FILENAMES.includes(name);
}

/**
 * Resolve the manifest path inside `pluginDir`, preferring the canonical name.
 * Returns null when neither name exists.
 */
export function findPluginManifestPath(pluginDir) {
  for (const filename of PLUGIN_MANIFEST_FILENAMES) {
    const candidate = path.join(pluginDir, filename);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Like findPluginManifestPath but always returns a path: falls back to the
 * canonical name so callers can report a sensible "missing file" error.
 */
export function resolvePluginManifestPath(pluginDir) {
  return findPluginManifestPath(pluginDir) ?? path.join(pluginDir, PLUGIN_MANIFEST_FILENAME);
}

/** Canonical package.json metadata key for plugin build/release metadata. */
export const PLUGIN_PACKAGE_METADATA_KEY = "astroclaw";

/** Pre-rebrand package.json metadata key; still accepted when reading. */
export const LEGACY_PLUGIN_PACKAGE_METADATA_KEY = "openclaw";

/**
 * Read a plugin package.json's build/release metadata block, preferring the
 * canonical `astroclaw` key and falling back to the pre-rebrand `openclaw` key.
 *
 * The 2026-05-17 rebrand rewrote every `extensions/*\/package.json` block to
 * `astroclaw`, but the build scripts kept reading `packageJson.openclaw` — so
 * every build/release opt-out (`build.bundledDist: false`, `release.publishToNpm`,
 * asset scripts, entry lists) silently evaluated as absent.
 */
export function pluginPackageMetadata(packageJson) {
  const canonical = packageJson?.[PLUGIN_PACKAGE_METADATA_KEY];
  if (canonical && typeof canonical === "object") {
    return canonical;
  }
  const legacy = packageJson?.[LEGACY_PLUGIN_PACKAGE_METADATA_KEY];
  return legacy && typeof legacy === "object" ? legacy : undefined;
}

/**
 * The metadata key a writer should use for `packageJson`: whichever key the
 * source already carries (canonical first), defaulting to the canonical key.
 *
 * Writing back through this key keeps a package.json single-keyed — rewriting a
 * legacy package under the canonical key would leave a stale `openclaw` block
 * behind that later readers could still resolve.
 */
export function pluginPackageMetadataKey(packageJson) {
  for (const key of [PLUGIN_PACKAGE_METADATA_KEY, LEGACY_PLUGIN_PACKAGE_METADATA_KEY]) {
    const value = packageJson?.[key];
    if (value && typeof value === "object") {
      return key;
    }
  }
  return PLUGIN_PACKAGE_METADATA_KEY;
}

/**
 * Shallow-copy `packageJson` with its plugin metadata block replaced, written
 * under whichever metadata key the source used.
 */
export function withPluginPackageMetadata(packageJson, metadata) {
  return { ...packageJson, [pluginPackageMetadataKey(packageJson)]: metadata };
}
