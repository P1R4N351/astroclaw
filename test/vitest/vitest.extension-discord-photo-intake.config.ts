// Vitest extension discord photo-intake config wires the photo-intake test shard.
//
// DELIBERATELY STANDALONE. Every other extension shard delegates to
// `createSingleChannelExtensionVitestConfig` in `vitest.extension-config.ts`,
// and that chain cannot load in this checkout: the 16 `packages/*` workspace
// packages are never linked (the root `package.json` declares no `@astroclaw/*`
// dependency) while `tsconfig.json` maps `@astroclaw/*` to `./extensions/*`, so
// `@astroclaw/normalization-core/agent-id` is unresolvable and the shared setup
// graph throws before a single test runs. That breakage predates this branch and
// reproduces on `main`; repairing it is tracked separately and is not a
// prerequisite for this shard.
//
// The photo-intake modules were written to depend only on node builtins, their
// own siblings, and type-only imports, precisely so this shard needs no aliases,
// no setup files, and no plugin SDK resolution. Once the shared harness is
// repaired this file should be collapsed into the standard factory.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Test files owned by the Discord photo-intake feature.
 *
 * Globs rather than an explicit list on purpose: an allowlist would silently
 * stop running a newly added sibling test, which is the failure mode where a
 * shard keeps reporting green while covering less than it claims.
 */
export const discordPhotoIntakeTestFiles = [
  "extensions/discord/src/monitor/photo-intake*.test.ts",
  "extensions/discord/src/actions/handle-action.photo-intake*.test.ts",
];

export function createExtensionDiscordPhotoIntakeVitestConfig(
  _env: Record<string, string | undefined> = process.env,
) {
  return defineConfig({
    root: REPO_ROOT,
    test: {
      name: "extension-discord-photo-intake",
      include: discordPhotoIntakeTestFiles,
      environment: "node",
      // No live network and no live Discord: every external seam in these
      // modules is injected, so the shard must stay hermetic.
      testTimeout: 20_000,
    },
  });
}

export default createExtensionDiscordPhotoIntakeVitestConfig();
