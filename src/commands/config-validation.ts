import { formatCliCommand } from "../cli/command-format.js";
import {
  type ConfigFileSnapshot,
  type AstroclawConfig,
  readConfigFileSnapshot,
} from "../config/config.js";
import { formatConfigIssueLines } from "../config/issue-format.js";
import {
  buildPluginCompatibilitySnapshotNotices,
  formatPluginCompatibilityNotice,
} from "../plugins/status.js";
import type { RuntimeEnv } from "../runtime.js";

export async function requireValidConfigFileSnapshot(
  runtime: RuntimeEnv,
  opts?: { includeCompatibilityAdvisory?: boolean },
): Promise<ConfigFileSnapshot | null> {
  const snapshot = await readConfigFileSnapshot();
  if (snapshot.exists && !snapshot.valid) {
    const issues =
      snapshot.issues.length > 0
        ? formatConfigIssueLines(snapshot.issues, "-").join("\n")
        : "Unknown validation issue.";
    runtime.error(`Astroclaw config is invalid: ${snapshot.path}\n${issues}`);
    runtime.error(`Fix: ${formatCliCommand("astroclaw doctor --fix")}`);
    runtime.error(`Inspect: ${formatCliCommand("astroclaw config validate")}`);
    runtime.exit(1);
    return null;
  }
  if (opts?.includeCompatibilityAdvisory !== true) {
    return snapshot;
  }
  const compatibility = buildPluginCompatibilitySnapshotNotices({ config: snapshot.config });
  if (compatibility.length > 0) {
    runtime.log(
      [
        `Plugin compatibility: ${compatibility.length} notice${compatibility.length === 1 ? "" : "s"}.`,
        ...compatibility
          .slice(0, 3)
          .map((notice) => `- ${formatPluginCompatibilityNotice(notice)}`),
        ...(compatibility.length > 3 ? [`- ... +${compatibility.length - 3} more`] : []),
        `Review: ${formatCliCommand("astroclaw doctor")}`,
      ].join("\n"),
    );
  }
  return snapshot;
}

export async function requireValidConfigSnapshot(
  runtime: RuntimeEnv,
  opts?: { includeCompatibilityAdvisory?: boolean },
): Promise<AstroclawConfig | null> {
  return (await requireValidConfigFileSnapshot(runtime, opts))?.config ?? null;
}
