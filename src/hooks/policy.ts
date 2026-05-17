import type { AstroclawConfig, HookConfig } from "../config/config.js";
import { resolveHookKey } from "./frontmatter.js";
import type { HookEntry, HookSource } from "./types.js";

export type HookEnableStateReason = "disabled in config" | "workspace hook (disabled by default)";

type HookEnableState = {
  enabled: boolean;
  reason?: HookEnableStateReason;
};

type HookSourcePolicy = {
  precedence: number;
  trustedLocalCode: boolean;
  defaultEnableMode: "default-on" | "explicit-opt-in";
  canOverride: HookSource[];
  canBeOverriddenBy: HookSource[];
};

type HookResolutionCollision = {
  name: string;
  kept: HookEntry;
  ignored: HookEntry;
};

const HOOK_SOURCE_POLICIES: Record<HookSource, HookSourcePolicy> = {
  "astroclaw-bundled": {
    precedence: 10,
    trustedLocalCode: true,
    defaultEnableMode: "default-on",
    canOverride: ["astroclaw-bundled"],
    canBeOverriddenBy: ["astroclaw-managed", "astroclaw-plugin"],
  },
  "astroclaw-plugin": {
    precedence: 20,
    trustedLocalCode: true,
    defaultEnableMode: "default-on",
    canOverride: ["astroclaw-bundled", "astroclaw-plugin"],
    canBeOverriddenBy: ["astroclaw-managed"],
  },
  "astroclaw-managed": {
    precedence: 30,
    trustedLocalCode: true,
    defaultEnableMode: "default-on",
    canOverride: ["astroclaw-bundled", "astroclaw-managed", "astroclaw-plugin"],
    canBeOverriddenBy: ["astroclaw-managed"],
  },
  "astroclaw-workspace": {
    precedence: 40,
    trustedLocalCode: true,
    defaultEnableMode: "explicit-opt-in",
    canOverride: ["astroclaw-workspace"],
    canBeOverriddenBy: ["astroclaw-workspace"],
  },
};

function getHookSourcePolicy(source: HookSource): HookSourcePolicy {
  return HOOK_SOURCE_POLICIES[source];
}

export function resolveHookConfig(
  config: AstroclawConfig | undefined,
  hookKey: string,
): HookConfig | undefined {
  const hooks = config?.hooks?.internal?.entries;
  if (!hooks || typeof hooks !== "object") {
    return undefined;
  }
  const entry = (hooks as Record<string, HookConfig | undefined>)[hookKey];
  if (!entry || typeof entry !== "object") {
    return undefined;
  }
  return entry;
}

export function resolveHookEnableState(params: {
  entry: HookEntry;
  config?: AstroclawConfig;
  hookConfig?: HookConfig;
}): HookEnableState {
  const { entry, config } = params;
  const hookKey = resolveHookKey(entry.hook.name, entry);
  const hookConfig = params.hookConfig ?? resolveHookConfig(config, hookKey);

  if (entry.hook.source === "astroclaw-plugin") {
    return { enabled: true };
  }
  if (hookConfig?.enabled === false) {
    return { enabled: false, reason: "disabled in config" };
  }

  const sourcePolicy = getHookSourcePolicy(entry.hook.source);
  if (sourcePolicy.defaultEnableMode === "explicit-opt-in" && hookConfig?.enabled !== true) {
    return { enabled: false, reason: "workspace hook (disabled by default)" };
  }

  return { enabled: true };
}

function canOverrideHook(candidate: HookEntry, existing: HookEntry): boolean {
  const candidatePolicy = getHookSourcePolicy(candidate.hook.source);
  const existingPolicy = getHookSourcePolicy(existing.hook.source);
  return (
    candidatePolicy.canOverride.includes(existing.hook.source) &&
    existingPolicy.canBeOverriddenBy.includes(candidate.hook.source)
  );
}

export function resolveHookEntries(
  entries: HookEntry[],
  opts?: {
    onCollisionIgnored?: (collision: HookResolutionCollision) => void;
  },
): HookEntry[] {
  const ordered = entries
    .map((entry, index) => ({ entry, index }))
    .toSorted((a, b) => {
      const precedenceDelta =
        getHookSourcePolicy(a.entry.hook.source).precedence -
        getHookSourcePolicy(b.entry.hook.source).precedence;
      return precedenceDelta !== 0 ? precedenceDelta : a.index - b.index;
    });

  const merged = new Map<string, HookEntry>();
  for (const { entry } of ordered) {
    const existing = merged.get(entry.hook.name);
    if (!existing) {
      merged.set(entry.hook.name, entry);
      continue;
    }
    if (canOverrideHook(entry, existing)) {
      merged.set(entry.hook.name, entry);
      continue;
    }
    opts?.onCollisionIgnored?.({
      name: entry.hook.name,
      kept: existing,
      ignored: entry,
    });
  }

  return Array.from(merged.values());
}
