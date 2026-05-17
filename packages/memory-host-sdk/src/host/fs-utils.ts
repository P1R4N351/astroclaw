import { configureFsSafePython } from "@astroclaw/fs-safe/config";
export { root } from "@astroclaw/fs-safe/root";
export { isPathInside, isPathInsideWithRealpath } from "@astroclaw/fs-safe/path";
export {
  assertNoSymlinkParents,
  readRegularFile,
  statRegularFile,
  type RegularFileStatResult,
} from "@astroclaw/fs-safe/advanced";
export { walkDirectory, type WalkDirectoryEntry } from "@astroclaw/fs-safe/walk";

const hasPythonModeOverride =
  process.env.FS_SAFE_PYTHON_MODE != null || process.env.ASTROCLAW_FS_SAFE_PYTHON_MODE != null;

if (!hasPythonModeOverride) {
  configureFsSafePython({ mode: "off" });
}

export function isFileMissingError(
  err: unknown,
): err is NodeJS.ErrnoException & { code: "ENOENT" | "ENOTDIR" | "not-found" } {
  return Boolean(
    err &&
    typeof err === "object" &&
    "code" in err &&
    ((err as Partial<NodeJS.ErrnoException>).code === "ENOENT" ||
      (err as Partial<NodeJS.ErrnoException>).code === "ENOTDIR" ||
      (err as { code?: unknown }).code === "not-found"),
  );
}
