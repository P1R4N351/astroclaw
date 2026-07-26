export const PLUGIN_MANIFEST_FILENAME: "astroclaw.plugin.json";
export const LEGACY_PLUGIN_MANIFEST_FILENAME: "openclaw.plugin.json";
export const PLUGIN_MANIFEST_FILENAMES: readonly string[];
export function isPluginManifestFilename(name: string): boolean;
export function findPluginManifestPath(pluginDir: string): string | null;
export function resolvePluginManifestPath(pluginDir: string): string;
export const PLUGIN_PACKAGE_METADATA_KEY: "astroclaw";
export const LEGACY_PLUGIN_PACKAGE_METADATA_KEY: "openclaw";
export function pluginPackageMetadata<T = Record<string, unknown>>(
  packageJson: unknown,
): T | undefined;
export function pluginPackageMetadataKey(packageJson: unknown): "astroclaw" | "openclaw";
export function withPluginPackageMetadata<T extends Record<string, unknown>>(
  packageJson: T,
  metadata: unknown,
): T;
