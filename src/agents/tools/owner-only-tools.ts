export const ASTROCLAW_OWNER_ONLY_CORE_TOOL_NAMES = ["cron", "gateway", "nodes"] as const;

const ASTROCLAW_OWNER_ONLY_CORE_TOOL_NAME_SET: ReadonlySet<string> = new Set(
  ASTROCLAW_OWNER_ONLY_CORE_TOOL_NAMES,
);

export function isAstroclawOwnerOnlyCoreToolName(toolName: string): boolean {
  return ASTROCLAW_OWNER_ONLY_CORE_TOOL_NAME_SET.has(toolName);
}
