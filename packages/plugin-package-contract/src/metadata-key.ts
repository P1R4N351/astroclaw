// Canonical (and legacy) package.json metadata key for plugin build/release metadata.
//
// Every shipped `extensions/*/package.json` carries its build/release metadata under an
// `astroclaw` key, but the build and release tooling kept reading the pre-rebrand `openclaw`
// key. Nothing errored: `packageJson.openclaw?.release?.publishToNpm !== true` simply evaluated
// `undefined !== true` for every package, so the npm publication gate skipped all of them,
// validated nothing, and exited green. A publication step that publishes nothing looks exactly
// like a publication step with nothing to do.
//
// Readers must therefore go through pluginPackageMetadata() rather than reaching for either key
// directly, so a single audited definition owns which key wins.
import { isRecord } from "../../normalization-core/src/record-coerce.js";

/** Canonical package.json metadata key for plugin build/release metadata. */
export const PLUGIN_PACKAGE_METADATA_KEY = "astroclaw";

/** Pre-rebrand package.json metadata key; accepted when reading, never written. */
export const LEGACY_PLUGIN_PACKAGE_METADATA_KEY = "openclaw";

/**
 * Read a plugin package.json's build/release metadata block, preferring the canonical
 * `astroclaw` key and falling back to the pre-rebrand `openclaw` key.
 *
 * MIGRATION SHIM — the `openclaw` fallback is deliberate and is not dead code. No in-repo
 * manifest declares that key (measured 2026-08-11: 0 of 122 `extensions/*` package.json), but
 * these contracts also validate EXTERNAL plugin packages resolved from npm and ClawHub, which
 * were authored against the pre-rebrand contract and still ship `openclaw` metadata. Dropping
 * the fallback would reject third-party plugins that are otherwise valid.
 *
 * The fallback is read-only on purpose. Writing back through the legacy key would mint an
 * `openclaw` block in a tree whose manifests have all been audited onto `astroclaw`, and in this
 * substrate the `astroclaw` name is an attestation that the code and metadata were audited to
 * P10 standards — not a cosmetic label. Emitting it mechanically would fabricate that claim.
 */
export function pluginPackageMetadata(packageJson: unknown): Record<string, unknown> | undefined {
  const root = isRecord(packageJson) ? packageJson : undefined;
  const canonical = root?.[PLUGIN_PACKAGE_METADATA_KEY];
  if (isRecord(canonical)) {
    return canonical;
  }
  const legacy = root?.[LEGACY_PLUGIN_PACKAGE_METADATA_KEY];
  return isRecord(legacy) ? legacy : undefined;
}

/**
 * The metadata key a writer should use for `packageJson`: whichever key the source already
 * carries, canonical first, defaulting to the canonical key.
 *
 * Writing back through this key keeps a package.json single-keyed. Rewriting a legacy package
 * under the canonical key instead would leave a stale `openclaw` block behind that later readers
 * could still resolve, which is how two disagreeing sources of truth get created.
 */
export function pluginPackageMetadataKey(
  packageJson: unknown,
): typeof PLUGIN_PACKAGE_METADATA_KEY | typeof LEGACY_PLUGIN_PACKAGE_METADATA_KEY {
  const root = isRecord(packageJson) ? packageJson : undefined;
  if (isRecord(root?.[PLUGIN_PACKAGE_METADATA_KEY])) {
    return PLUGIN_PACKAGE_METADATA_KEY;
  }
  if (isRecord(root?.[LEGACY_PLUGIN_PACKAGE_METADATA_KEY])) {
    return LEGACY_PLUGIN_PACKAGE_METADATA_KEY;
  }
  return PLUGIN_PACKAGE_METADATA_KEY;
}
