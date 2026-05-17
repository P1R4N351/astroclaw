import type { AstroclawConfig } from "astroclaw/plugin-sdk/config-contracts";

export type IMessageAccountConfig = Omit<
  NonNullable<NonNullable<AstroclawConfig["channels"]>["imessage"]>,
  "accounts" | "defaultAccount"
>;
