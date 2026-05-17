import type { AstroclawConfig } from "astroclaw/plugin-sdk/config-contracts";

export type WhatsAppAccountConfig = NonNullable<
  NonNullable<NonNullable<AstroclawConfig["channels"]>["whatsapp"]>["accounts"]
>[string];
