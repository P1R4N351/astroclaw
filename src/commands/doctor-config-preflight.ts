import fs from "node:fs/promises";
import path from "node:path";
import {
  readConfigFileSnapshot,
  recoverConfigFromJsonRootSuffix,
  recoverConfigFromLastKnownGood,
} from "../config/io.js";
import { formatConfigIssueLines } from "../config/issue-format.js";
import type { LegacyConfigIssue } from "../config/types.js";
import type { AstroclawConfig } from "../config/types.astroclaw.js";
import { isTruthyEnvValue } from "../infra/env.js";
import { note } from "../terminal/note.js";
import { resolveHomeDir } from "../utils.js";
import { noteIncludeConfinementWarning } from "./doctor-config-analysis.js";
import { findDoctorLegacyConfigIssues } from "./doctor/shared/legacy-config-issues.js";

async function maybeMigrateLegacyConfig(): Promise<string[]> {
  const changes: string[] = [];
  const home = resolveHomeDir();
  if (!home) {
    return changes;
  }

  const targetDir = path.join(home, ".astroclaw");
  const targetPath = path.join(targetDir, "astroclaw.json");
  try {
    await fs.access(targetPath);
    return changes;
  } catch {
    // missing config
  }

  const legacyCandidates = [path.join(home, ".clawdbot", "clawdbot.json")];

  let legacyPath: string | null = null;
  for (const candidate of legacyCandidates) {
    try {
      await fs.access(candidate);
      legacyPath = candidate;
      break;
    } catch {
      // continue
    }
  }
  if (!legacyPath) {
    return changes;
  }

  await fs.mkdir(targetDir, { recursive: true });
  try {
    await fs.copyFile(legacyPath, targetPath, fs.constants.COPYFILE_EXCL);
    changes.push(`Migrated legacy config: ${legacyPath} -> ${targetPath}`);
  } catch {
    // If it already exists, skip silently.
  }

  return changes;
}

export type DoctorConfigPreflightResult = {
  snapshot: Awaited<ReturnType<typeof readConfigFileSnapshot>>;
  baseConfig: AstroclawConfig;
};

function collectDoctorLegacyIssues(
  snapshot: Awaited<ReturnType<typeof readConfigFileSnapshot>>,
): LegacyConfigIssue[] {
  if (!snapshot.exists) {
    return [];
  }
  const resolvedRaw = snapshot.sourceConfig ?? snapshot.config ?? {};
  const sourceRaw = snapshot.parsed ?? resolvedRaw;
  return findDoctorLegacyConfigIssues(resolvedRaw, sourceRaw);
}

function addDoctorLegacyIssues(
  snapshot: Awaited<ReturnType<typeof readConfigFileSnapshot>>,
): Awaited<ReturnType<typeof readConfigFileSnapshot>> {
  const legacyIssues = collectDoctorLegacyIssues(snapshot);
  if (legacyIssues.length === 0) {
    return snapshot;
  }
  return { ...snapshot, legacyIssues };
}

export function shouldSkipPluginValidationForDoctorConfigPreflight(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isTruthyEnvValue(env.ASTROCLAW_UPDATE_IN_PROGRESS);
}

export async function runDoctorConfigPreflight(
  options: {
    migrateState?: boolean;
    migrateLegacyConfig?: boolean;
    repairPrefixedConfig?: boolean;
    invalidConfigNote?: string | false;
  } = {},
): Promise<DoctorConfigPreflightResult> {
  if (options.migrateState !== false) {
    const { autoMigrateLegacyStateDir } = await import("./doctor-state-migrations.js");
    const stateDirResult = await autoMigrateLegacyStateDir({ env: process.env });
    if (stateDirResult.changes.length > 0) {
      note(stateDirResult.changes.map((entry) => `- ${entry}`).join("\n"), "Doctor changes");
    }
    if (stateDirResult.warnings.length > 0) {
      note(stateDirResult.warnings.map((entry) => `- ${entry}`).join("\n"), "Doctor warnings");
    }
  }

  if (options.migrateLegacyConfig !== false) {
    const legacyConfigChanges = await maybeMigrateLegacyConfig();
    if (legacyConfigChanges.length > 0) {
      note(legacyConfigChanges.map((entry) => `- ${entry}`).join("\n"), "Doctor changes");
    }
  }

  const readOptions = {
    skipPluginValidation: shouldSkipPluginValidationForDoctorConfigPreflight(),
  };
  let snapshot = addDoctorLegacyIssues(await readConfigFileSnapshot(readOptions));
  if (options.repairPrefixedConfig === true && snapshot.exists && !snapshot.valid) {
    if (await recoverConfigFromJsonRootSuffix(snapshot)) {
      note("Removed non-JSON prefix from astroclaw.json; original saved as .clobbered.*.", "Config");
      snapshot = addDoctorLegacyIssues(await readConfigFileSnapshot(readOptions));
    } else if (
      await recoverConfigFromLastKnownGood({ snapshot, reason: "doctor-invalid-config" })
    ) {
      note(
        "Restored astroclaw.json from last-known-good; original saved as .clobbered.*.",
        "Config",
      );
      snapshot = addDoctorLegacyIssues(await readConfigFileSnapshot(readOptions));
    }
  }
  const invalidConfigNote =
    options.invalidConfigNote ?? "Config invalid; doctor will run with best-effort config.";
  if (
    invalidConfigNote &&
    snapshot.exists &&
    !snapshot.valid &&
    snapshot.legacyIssues.length === 0
  ) {
    note(invalidConfigNote, "Config");
    noteIncludeConfinementWarning(snapshot);
  }

  const warnings = snapshot.warnings ?? [];
  if (warnings.length > 0) {
    note(formatConfigIssueLines(warnings, "-").join("\n"), "Config warnings");
  }

  return {
    snapshot,
    baseConfig: snapshot.sourceConfig ?? snapshot.config ?? {},
  };
}
