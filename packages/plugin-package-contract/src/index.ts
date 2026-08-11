// External code plugin package.json compatibility and validation contracts.
import { isRecord } from "../../normalization-core/src/record-coerce.js";
import { normalizeOptionalString } from "../../normalization-core/src/string-coerce.js";
import { pluginPackageMetadata, PLUGIN_PACKAGE_METADATA_KEY } from "./metadata-key.js";

export {
  LEGACY_PLUGIN_PACKAGE_METADATA_KEY,
  PLUGIN_PACKAGE_METADATA_KEY,
  pluginPackageMetadata,
  pluginPackageMetadataKey,
} from "./metadata-key.js";

/** JSON object shape accepted by package contract helpers. */
export type JsonObject = Record<string, unknown>;

/** Compatibility metadata extracted from an external plugin package. */
export type ExternalPluginCompatibility = {
  pluginApiRange?: string;
  builtWithOpenClawVersion?: string;
  pluginSdkVersion?: string;
  minGatewayVersion?: string;
};

/** One validation issue for an external plugin package. */
export type ExternalPluginValidationIssue = {
  fieldPath: string;
  message: string;
};

/** Validation result plus any normalized compatibility metadata. */
export type ExternalCodePluginValidationResult = {
  compatibility?: ExternalPluginCompatibility;
  issues: ExternalPluginValidationIssue[];
};

/** Required package.json field paths for external code plugin packages. */
export const EXTERNAL_CODE_PLUGIN_REQUIRED_FIELD_PATHS = [
  `${PLUGIN_PACKAGE_METADATA_KEY}.compat.pluginApi`,
  `${PLUGIN_PACKAGE_METADATA_KEY}.build.astroclawVersion`,
] as const;

/** Read plugin package.json metadata blocks without trusting caller input shape. */
function readPluginMetadataBlock(packageJson: unknown) {
  const root = isRecord(packageJson) ? packageJson : undefined;
  const metadata = pluginPackageMetadata(packageJson);
  const compat = isRecord(metadata?.compat) ? metadata.compat : undefined;
  const build = isRecord(metadata?.build) ? metadata.build : undefined;
  const install = isRecord(metadata?.install) ? metadata.install : undefined;
  return { root, metadata, compat, build, install };
}

/**
 * The host version a plugin declares it was built against.
 *
 * MIGRATION SHIM, matching the metadata-key fallback: the rebrand renamed the inner field
 * `openclawVersion` to `astroclawVersion` alongside the enclosing key, so an external plugin
 * package authored before the rebrand carries `openclaw.build.openclawVersion`. Reading only the
 * canonical name would report every such package as missing a required field.
 */
function readDeclaredHostVersion(build: Record<string, unknown> | undefined): string | undefined {
  return (
    normalizeOptionalString(build?.astroclawVersion) ??
    normalizeOptionalString(build?.openclawVersion)
  );
}

/** Normalize compatibility metadata from an external plugin package.json. */
export function normalizeExternalPluginCompatibility(
  packageJson: unknown,
): ExternalPluginCompatibility | undefined {
  const { root, compat, build, install } = readPluginMetadataBlock(packageJson);
  const version = normalizeOptionalString(root?.version);
  const minHostVersion = normalizeOptionalString(install?.minHostVersion);
  const compatibility: ExternalPluginCompatibility = {};

  const pluginApi = normalizeOptionalString(compat?.pluginApi);
  if (pluginApi) {
    compatibility.pluginApiRange = pluginApi;
  }

  const minGatewayVersion = normalizeOptionalString(compat?.minGatewayVersion) ?? minHostVersion;
  if (minGatewayVersion) {
    compatibility.minGatewayVersion = minGatewayVersion;
  }

  // The `builtWithOpenClawVersion` property name is carried unchanged on purpose: it is a public
  // in-memory field consumed across src/plugins and src/infra, and renaming a symbol in this
  // substrate asserts that the consuming files were audited. Only the manifest field being read
  // is corrected here.
  const builtWithHostVersion = readDeclaredHostVersion(build) ?? version;
  if (builtWithHostVersion) {
    compatibility.builtWithOpenClawVersion = builtWithHostVersion;
  }

  const pluginSdkVersion = normalizeOptionalString(build?.pluginSdkVersion);
  if (pluginSdkVersion) {
    compatibility.pluginSdkVersion = pluginSdkVersion;
  }

  return Object.keys(compatibility).length > 0 ? compatibility : undefined;
}

/** List missing required field paths for an external code plugin package.json. */
export function listMissingExternalCodePluginFieldPaths(packageJson: unknown): string[] {
  const { compat, build } = readPluginMetadataBlock(packageJson);
  const [pluginApiFieldPath, hostVersionFieldPath] = EXTERNAL_CODE_PLUGIN_REQUIRED_FIELD_PATHS;
  const missing: string[] = [];
  if (!normalizeOptionalString(compat?.pluginApi)) {
    missing.push(pluginApiFieldPath);
  }
  if (!readDeclaredHostVersion(build)) {
    missing.push(hostVersionFieldPath);
  }
  return missing;
}

/** Validate an external code plugin package.json against required compatibility fields. */
export function validateExternalCodePluginPackageJson(
  packageJson: unknown,
): ExternalCodePluginValidationResult {
  const issues = listMissingExternalCodePluginFieldPaths(packageJson).map((fieldPath) => ({
    fieldPath,
    message: `${fieldPath} is required for external code plugin packages.`,
  }));
  return {
    compatibility: normalizeExternalPluginCompatibility(packageJson),
    issues,
  };
}
