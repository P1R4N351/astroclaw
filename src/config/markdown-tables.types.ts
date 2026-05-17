import type { MarkdownTableMode } from "./types.base.js";
import type { AstroclawConfig } from "./types.astroclaw.js";

export type ResolveMarkdownTableModeParams = {
  cfg?: Partial<AstroclawConfig>;
  channel?: string | null;
  accountId?: string | null;
};

export type ResolveMarkdownTableMode = (
  params: ResolveMarkdownTableModeParams,
) => MarkdownTableMode;
