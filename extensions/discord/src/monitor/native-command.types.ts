import type { AstroclawConfig } from "astroclaw/plugin-sdk/config-contracts";
import type { CommandArgValues } from "astroclaw/plugin-sdk/native-command-registry";

export type DiscordConfig = NonNullable<AstroclawConfig["channels"]>["discord"];

export type DiscordCommandArgs = {
  raw?: string;
  values?: CommandArgValues;
};
