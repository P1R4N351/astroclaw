import type { AstroclawConfig } from "astroclaw/plugin-sdk/config-contracts";

export function makeQqbotSecretRefConfig(): AstroclawConfig {
  return {
    channels: {
      qqbot: {
        appId: "123456",
        clientSecret: {
          source: "env",
          provider: "default",
          id: "QQBOT_CLIENT_SECRET",
        },
      },
    },
  } as AstroclawConfig;
}

export function makeQqbotDefaultAccountConfig(): AstroclawConfig {
  return {
    channels: {
      qqbot: {
        defaultAccount: "bot2",
        accounts: {
          bot2: { appId: "123456" },
        },
      },
    },
  } as AstroclawConfig;
}
