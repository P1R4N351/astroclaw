// Discord plugin module implements photo intake staging runtime behavior.
//
// Lazy boundary between the pure staging logic and the SDK-backed filesystem
// append, per the repo's `*.runtime.ts` convention. Keeping the SDK imports
// here means the staging logic and its tests never need them resolved.
import path from "node:path";
import { appendRegularFile } from "astroclaw/plugin-sdk/security-runtime";
import { resolveStateDir } from "astroclaw/plugin-sdk/state-paths";
import type { PhotoIntakeStagingSink } from "./photo-intake.staging.js";

/**
 * Default sink: appends under the resolved state dir. `rejectSymlinkParents`
 * matches the repo's other journals -- a symlinked parent is how an append
 * lands somewhere it was never meant to.
 */
export function createPhotoIntakeStagingSink(params?: {
  env?: NodeJS.ProcessEnv;
  stateDir?: string;
}): PhotoIntakeStagingSink {
  return async ({ relativePath, line, maxFileBytes }) => {
    const stateDir = params?.stateDir ?? resolveStateDir(params?.env ?? process.env);
    const filePath = path.join(stateDir, relativePath);
    const { mkdir } = await import("node:fs/promises");
    await mkdir(path.dirname(filePath), { recursive: true });
    await appendRegularFile({
      filePath,
      content: line,
      maxFileBytes,
      rejectSymlinkParents: true,
    });
  };
}
