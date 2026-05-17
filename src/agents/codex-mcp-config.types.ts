import type { AstroclawConfig } from "../config/types.astroclaw.js";
import type { BundleMcpDiagnostic } from "../plugins/bundle-mcp.js";

export type CodexMcpServersConfig = Record<string, Record<string, unknown>>;

export type CodexBundleMcpThreadConfig = {
  configPatch?: {
    mcp_servers: CodexMcpServersConfig;
  };
  diagnostics: BundleMcpDiagnostic[];
  evaluated: boolean;
  fingerprint?: string;
};

export type LoadCodexBundleMcpThreadConfigParams = {
  workspaceDir: string;
  cfg?: AstroclawConfig;
  toolsEnabled?: boolean;
  disableTools?: boolean;
  toolsAllow?: string[];
};
