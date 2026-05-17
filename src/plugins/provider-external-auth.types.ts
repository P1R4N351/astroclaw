import type { AuthProfileStore, OAuthCredential } from "../agents/auth-profiles/types.js";
import type { ModelProviderAuthMode, ModelProviderConfig } from "../config/types.js";
import type { AstroclawConfig } from "../config/types.astroclaw.js";

export type ProviderResolveSyntheticAuthContext = {
  config?: AstroclawConfig;
  provider: string;
  providerConfig?: ModelProviderConfig;
};

export type ProviderSyntheticAuthResult = {
  apiKey: string;
  source: string;
  mode: Exclude<ModelProviderAuthMode, "aws-sdk">;
  expiresAt?: number;
};

export type ProviderResolveExternalOAuthProfilesContext = {
  config?: AstroclawConfig;
  agentDir?: string;
  workspaceDir?: string;
  env: NodeJS.ProcessEnv;
  store: AuthProfileStore;
};

export type ProviderResolveExternalAuthProfilesContext =
  ProviderResolveExternalOAuthProfilesContext;

export type ProviderExternalOAuthProfile = {
  profileId: string;
  credential: OAuthCredential;
  persistence?: "runtime-only" | "persisted";
};

export type ProviderExternalAuthProfile = ProviderExternalOAuthProfile;
