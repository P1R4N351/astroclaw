import type { AstroclawConfig } from "../../config/types.js";

export type DirectoryConfigParams = {
  cfg: AstroclawConfig;
  accountId?: string | null;
  query?: string | null;
  limit?: number | null;
};
