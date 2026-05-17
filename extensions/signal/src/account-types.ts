import type { AstroclawConfig } from "astroclaw/plugin-sdk/config-contracts";

export type SignalAccountConfig = Omit<
  Exclude<NonNullable<AstroclawConfig["channels"]>["signal"], undefined>,
  "accounts"
>;
