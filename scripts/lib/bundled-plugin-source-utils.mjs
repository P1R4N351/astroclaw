// Discovers bundled plugin source directories and reads optional metadata files.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  findPluginManifestPath,
  isPluginManifestFilename,
  PLUGIN_MANIFEST_FILENAMES,
} from "./plugin-manifest-filenames.mjs";

/** Read a UTF-8 file when it exists, returning null on missing/unreadable paths. */
export function readIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function collectTrackedBundledPluginSourceCandidates(repoRoot) {
  const result = spawnSync(
    "git",
    [
      "ls-files",
      "--",
      ...PLUGIN_MANIFEST_FILENAMES.map((filename) => `:(glob)extensions/*/${filename}`),
      ":(glob)extensions/*/package.json",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    },
  );
  if (result.status !== 0) {
    return null;
  }

  const candidatesByDir = new Map();
  for (const rawLine of result.stdout.split("\n")) {
    const line = rawLine.trim().replaceAll("\\", "/");
    const match = /^extensions\/([^/]+)\/([^/]+)$/u.exec(line);
    if (!match?.[1] || !match[2]) {
      continue;
    }
    const basename = match[2];
    if (basename !== "package.json" && !isPluginManifestFilename(basename)) {
      continue;
    }
    const current = candidatesByDir.get(match[1]) ?? {
      dirName: match[1],
      manifestPath: null,
      packageJsonPath: null,
      pluginDir: path.join(repoRoot, "extensions", match[1]),
    };
    if (basename === "package.json") {
      current.packageJsonPath = path.join(repoRoot, line);
    } else if (
      current.manifestPath === null ||
      PLUGIN_MANIFEST_FILENAMES.indexOf(basename) <
        PLUGIN_MANIFEST_FILENAMES.indexOf(path.basename(current.manifestPath))
    ) {
      current.manifestPath = path.join(repoRoot, line);
    }
    candidatesByDir.set(match[1], current);
  }

  return [...candidatesByDir.values()].toSorted((left, right) =>
    left.dirName.localeCompare(right.dirName),
  );
}

function collectBundledPluginSourceCandidatesFromDirectory(repoRoot) {
  const extensionsRoot = path.join(repoRoot, "extensions");
  if (!fs.existsSync(extensionsRoot)) {
    return [];
  }

  return fs
    .readdirSync(extensionsRoot, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => {
      const pluginDir = path.join(extensionsRoot, dirent.name);
      const manifestPath = findPluginManifestPath(pluginDir);
      const packageJsonPath = path.join(pluginDir, "package.json");
      return {
        dirName: dirent.name,
        manifestPath,
        packageJsonPath: fs.existsSync(packageJsonPath) ? packageJsonPath : null,
        pluginDir,
      };
    })
    .toSorted((left, right) => left.dirName.localeCompare(right.dirName));
}

/** Collect bundled plugin manifests and package metadata from git or the extensions directory. */
export function collectBundledPluginSources(params = {}) {
  const repoRoot = path.resolve(params.repoRoot ?? process.cwd());
  const requirePackageJson = params.requirePackageJson === true;
  const entries = [];
  const candidates =
    collectTrackedBundledPluginSourceCandidates(repoRoot) ??
    collectBundledPluginSourceCandidatesFromDirectory(repoRoot);
  for (const { dirName, manifestPath, packageJsonPath, pluginDir } of candidates) {
    if (!manifestPath) {
      continue;
    }
    if (requirePackageJson && !packageJsonPath) {
      continue;
    }

    entries.push({
      dirName,
      pluginDir,
      manifestPath,
      manifest: JSON.parse(fs.readFileSync(manifestPath, "utf8")),
      ...(packageJsonPath
        ? {
            packageJsonPath,
            packageJson: JSON.parse(fs.readFileSync(packageJsonPath, "utf8")),
          }
        : {}),
    });
  }

  return entries.toSorted((left, right) => left.dirName.localeCompare(right.dirName));
}
