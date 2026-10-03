// Exposes root-scoped file open helpers with fs-safe defaults.
import "./fs-safe-defaults.js";
import {
  matchRootFileOpenFailure as matchRootFileOpenFailureFsSafe,
  type RootFileOpenFailure,
} from "@openclaw/fs-safe/advanced";
import { FsSafeError } from "@openclaw/fs-safe/errors";
// PINNED-DEPENDENCY DIVERGENCE (P-BACKLOG [5e868d4]; same class as [8a8e8b0]).
// This branch pins @openclaw/fs-safe 0.2.4, whose ./advanced does NOT export
// readFileDescriptorBounded / readFileDescriptorBoundedSync (upstream-only, fs-safe
// >= 0.5.0). Importing them yields undefined, so every call threw "is not a
// function" and readPluginCacheFile folded it into reason "io": EVERY plugin
// manifest load failed with "unsafe plugin manifest path ... (io)". The local
// helpers keep the same RangeError("File exceeds N bytes") overflow contract.
// Keep this until package.json moves to fs-safe >= 0.5.0; do not re-materialize
// the upstream import (p10 rewrite 0a718e16c8e introduced it).
import {
  readFileDescriptorBounded as readFileDescriptorBoundedFsSafe,
  readFileDescriptorBoundedSync as readFileDescriptorBoundedSyncFsSafe,
} from "./file-descriptor-read.js";

// Root-scoped file open helpers. Use these for user paths that must stay under
// an already trusted boundary.
export {
  canUseRootFileOpen,
  matchRootFileOpenFailure,
  openRootFile,
  openRootFileSync,
  type RootFileOpenFailure,
  type RootFileOpenResult,
} from "@openclaw/fs-safe/advanced";

// fs-safe folds ENOENT, ENOTDIR, and ELOOP into its `path` reason. Only the
// first two mean the artifact is absent; a symlink loop is an unreadable path.
const MISSING_PATH_ERROR_CODES: ReadonlySet<string> = new Set(["ENOENT", "ENOTDIR"]);

function readFailureErrorCode(error: unknown): string | undefined {
  const code = error && typeof error === "object" ? (error as { code?: unknown }).code : undefined;
  return typeof code === "string" && code ? code : undefined;
}

export function isRootFileMissingFailure(failure: RootFileOpenFailure): boolean {
  return (
    failure.reason === "path" &&
    MISSING_PATH_ERROR_CODES.has(readFailureErrorCode(failure.error) ?? "")
  );
}

/**
 * Describes a root-scoped open failure without collapsing every cause into a
 * containment violation. Only `validation` means the path failed the boundary or
 * alias check; a missing artifact or an unreadable descriptor is an ordinary
 * operational state, and reporting those as escapes sends operators hunting a
 * security incident that never happened.
 */
export function describeRootFileOpenFailure(params: {
  failure: RootFileOpenFailure;
  subject: string;
  boundaryLabel: string;
  filePath: string;
}): string {
  const unreadable = (code?: string) =>
    `${params.subject} could not be read${code ? ` (${code})` : ""}: ${params.filePath}`;
  return matchRootFileOpenFailureFsSafe(params.failure, {
    path: (failure) => {
      const code = readFailureErrorCode(failure.error);
      return isRootFileMissingFailure(failure)
        ? `${params.subject} not found: ${params.filePath}`
        : unreadable(code);
    },
    validation: () =>
      `${params.subject} escapes ${params.boundaryLabel} or fails alias checks: ${params.filePath}`,
    fallback: (failure) => unreadable(readFailureErrorCode(failure.error)),
  });
}

function preserveOpenClawOverflowError(error: unknown, maxBytes: number): never {
  if (error instanceof FsSafeError && error.code === "too-large") {
    throw new RangeError(`File exceeds ${maxBytes} bytes`, { cause: error });
  }
  throw error;
}

/** Read a pinned descriptor without changing OpenClaw's user-facing overflow error. */
export async function readFileDescriptorBounded(fd: number, maxBytes: number): Promise<Buffer> {
  try {
    return await readFileDescriptorBoundedFsSafe(fd, maxBytes);
  } catch (error) {
    return preserveOpenClawOverflowError(error, maxBytes);
  }
}

/** Synchronous variant for callers that own a pinned descriptor. */
export function readFileDescriptorBoundedSync(fd: number, maxBytes: number): Buffer {
  try {
    return readFileDescriptorBoundedSyncFsSafe(fd, maxBytes);
  } catch (error) {
    return preserveOpenClawOverflowError(error, maxBytes);
  }
}
