import { resolveIsNixMode } from "./paths.js";

export const NIX_ASTROCLAW_AGENT_FIRST_URL = "https://github.com/astroclaw/nix-astroclaw#quick-start";
export const ASTROCLAW_NIX_OVERVIEW_URL = "https://docs.astroclaw.ai/install/nix";

export class NixModeConfigMutationError extends Error {
  readonly code = "ASTROCLAW_NIX_MODE_CONFIG_IMMUTABLE";

  constructor(params: { configPath?: string } = {}) {
    super(formatNixModeConfigMutationMessage(params));
    this.name = "NixModeConfigMutationError";
  }
}

export function formatNixModeConfigMutationMessage(params: { configPath?: string } = {}): string {
  return [
    "Config is managed by Nix (`ASTROCLAW_NIX_MODE=1`), so Astroclaw treats astroclaw.json as immutable.",
    "This usually means nix-astroclaw, the first-party Nix distribution, or another Nix-managed package set this mode.",
    ...(params.configPath ? [`Config path: ${params.configPath}`] : []),
    "Do not run setup, onboarding, astroclaw update, plugin install/update/uninstall/enable, doctor repair/token-generation, or config set against this file.",
    "Edit the Nix source for this install instead. For nix-astroclaw, edit `programs.astroclaw.config` or `instances.<name>.config`, then rebuild with Home Manager or NixOS.",
    `Agent-first Nix setup: ${NIX_ASTROCLAW_AGENT_FIRST_URL}`,
    `Astroclaw Nix overview: ${ASTROCLAW_NIX_OVERVIEW_URL}`,
  ].join("\n");
}

export function assertConfigWriteAllowedInCurrentMode(
  params: {
    configPath?: string;
    env?: NodeJS.ProcessEnv;
  } = {},
): void {
  if (!resolveIsNixMode(params.env)) {
    return;
  }
  throw new NixModeConfigMutationError({ configPath: params.configPath });
}
