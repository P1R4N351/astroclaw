import type { PhotoIntakeContext, PhotoIntakeContextStore } from "../monitor/photo-intake.js";
import { createPhotoIntakeStagingSink } from "../monitor/photo-intake.staging.runtime.js";
import { createDirectBranch0VisionAnalyzer } from "../monitor/photo-intake.vision.js";
// Discord plugin module implements handle action.photo intake runtime behavior.
//
// Lazy boundary that supplies the default dependencies for photo-intake action
// dispatch. Keeping the runtime wiring here means the dispatch logic and its
// tests stay free of the plugin runtime, the filesystem, and the network.
import { getDiscordRuntime } from "../runtime.js";
import type { PhotoIntakeActionDeps } from "./handle-action.photo-intake.js";

/** Intake contexts are short-lived: a menu the operator never presses is dead weight. */
const PHOTO_INTAKE_CONTEXT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PHOTO_INTAKE_CONTEXT_MAX_ENTRIES = 5_000;

export function createPhotoIntakeContextStore(env?: NodeJS.ProcessEnv): PhotoIntakeContextStore {
  const openStore = () =>
    getDiscordRuntime().state.openKeyedStore<PhotoIntakeContext>({
      namespace: "photo-intake-contexts",
      maxEntries: PHOTO_INTAKE_CONTEXT_MAX_ENTRIES,
      overflowPolicy: "evict-oldest",
      defaultTtlMs: PHOTO_INTAKE_CONTEXT_TTL_MS,
      ...(env ? { env } : {}),
    });
  return {
    save: async (context) => {
      await openStore().register(context.intakeId, context);
    },
    load: async (intakeId) => await openStore().lookup(intakeId),
  };
}

export function createDefaultPhotoIntakeActionDeps(env?: NodeJS.ProcessEnv): PhotoIntakeActionDeps {
  return {
    store: createPhotoIntakeContextStore(env),
    stagingSink: createPhotoIntakeStagingSink(env ? { env } : undefined),
    analyzeVision: createDirectBranch0VisionAnalyzer(),
    readImage: async (localPath) => {
      const { readFile } = await import("node:fs/promises");
      return await readFile(localPath);
    },
  };
}
