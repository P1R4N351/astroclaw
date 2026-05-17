// Real workspace contract for memory engine foundation concerns.

export {
  resolveAgentContextLimits,
  resolveAgentDir,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
  resolveSessionAgentId,
} from "./host/astroclaw-runtime-agent.js";
export {
  resolveMemorySearchConfig,
  resolveMemorySearchSyncConfig,
  type ResolvedMemorySearchConfig,
  type ResolvedMemorySearchSyncConfig,
} from "./host/astroclaw-runtime-agent.js";
export { parseDurationMs } from "./host/astroclaw-runtime-config.js";
export { loadConfig } from "./host/astroclaw-runtime-config.js";
export { resolveStateDir } from "./host/astroclaw-runtime-config.js";
export { resolveSessionTranscriptsDirForAgent } from "./host/astroclaw-runtime-config.js";
export {
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
} from "./host/astroclaw-runtime-config.js";
export { root } from "./host/astroclaw-runtime-io.js";
export { isPathInside } from "./host/fs-utils.js";
export { createSubsystemLogger } from "./host/astroclaw-runtime-io.js";
export { detectMime } from "./host/astroclaw-runtime-io.js";
export { resolveGlobalSingleton } from "./host/astroclaw-runtime-io.js";
export { onSessionTranscriptUpdate } from "./host/astroclaw-runtime-session.js";
export { splitShellArgs } from "./host/astroclaw-runtime-io.js";
export { runTasksWithConcurrency } from "./host/astroclaw-runtime-io.js";
export {
  shortenHomeInString,
  shortenHomePath,
  resolveUserPath,
  truncateUtf16Safe,
} from "./host/astroclaw-runtime-io.js";
export type { AstroclawConfig } from "./host/astroclaw-runtime-config.js";
export type { SessionSendPolicyConfig } from "./host/astroclaw-runtime-config.js";
export type { SecretInput } from "./host/astroclaw-runtime-config.js";
export type {
  MemoryBackend,
  MemoryCitationsMode,
  MemoryQmdConfig,
  MemoryQmdIndexPath,
  MemoryQmdMcporterConfig,
  MemoryQmdSearchMode,
} from "./host/astroclaw-runtime-config.js";
export type { MemorySearchConfig } from "./host/astroclaw-runtime-config.js";
