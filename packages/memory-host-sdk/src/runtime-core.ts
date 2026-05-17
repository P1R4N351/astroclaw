// Focused runtime contract for memory plugin config/state/helpers.

export type { AnyAgentTool } from "./host/astroclaw-runtime-agent.js";
export { resolveCronStyleNow } from "./host/astroclaw-runtime-agent.js";
export { DEFAULT_PI_COMPACTION_RESERVE_TOKENS_FLOOR } from "./host/astroclaw-runtime-agent.js";
export { resolveDefaultAgentId, resolveSessionAgentId } from "./host/astroclaw-runtime-agent.js";
export { resolveMemorySearchConfig } from "./host/astroclaw-runtime-agent.js";
export {
  asToolParamsRecord,
  jsonResult,
  readNumberParam,
  readStringParam,
} from "./host/astroclaw-runtime-agent.js";
export { SILENT_REPLY_TOKEN } from "./host/astroclaw-runtime-session.js";
export { parseNonNegativeByteSize } from "./host/astroclaw-runtime-config.js";
export {
  getRuntimeConfig,
  /** @deprecated Use getRuntimeConfig(), or pass the already loaded config through the call path. */
  loadConfig,
} from "./host/astroclaw-runtime-config.js";
export { resolveStateDir } from "./host/astroclaw-runtime-config.js";
export { resolveSessionTranscriptsDirForAgent } from "./host/astroclaw-runtime-config.js";
export { emptyPluginConfigSchema } from "./host/astroclaw-runtime-memory.js";
export {
  buildActiveMemoryPromptSection,
  getMemoryCapabilityRegistration,
  listActiveMemoryPublicArtifacts,
} from "./host/astroclaw-runtime-memory.js";
export { parseAgentSessionKey } from "./host/astroclaw-runtime-agent.js";
export type { AstroclawConfig } from "./host/astroclaw-runtime-config.js";
export type { MemoryCitationsMode } from "./host/astroclaw-runtime-config.js";
export type {
  MemoryFlushPlan,
  MemoryFlushPlanResolver,
  MemoryPluginCapability,
  MemoryPluginPublicArtifact,
  MemoryPluginPublicArtifactsProvider,
  MemoryPluginRuntime,
  MemoryPromptSectionBuilder,
} from "./host/astroclaw-runtime-memory.js";
export type { AstroclawPluginApi } from "./host/astroclaw-runtime-memory.js";
