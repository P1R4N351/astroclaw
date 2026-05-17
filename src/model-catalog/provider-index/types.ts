import type { ModelCatalogProvider } from "../types.js";

export type AstroclawProviderIndexPluginInstall = {
  clawhubSpec?: string;
  npmSpec?: string;
  defaultChoice?: "clawhub" | "npm";
  minHostVersion?: string;
  expectedIntegrity?: string;
};

export type AstroclawProviderIndexPlugin = {
  id: string;
  package?: string;
  source?: string;
  install?: AstroclawProviderIndexPluginInstall;
};

export type AstroclawProviderIndexProviderAuthChoice = {
  method: string;
  choiceId: string;
  choiceLabel: string;
  choiceHint?: string;
  assistantPriority?: number;
  assistantVisibility?: "visible" | "manual-only";
  groupId?: string;
  groupLabel?: string;
  groupHint?: string;
  optionKey?: string;
  cliFlag?: string;
  cliOption?: string;
  cliDescription?: string;
  onboardingScopes?: readonly ("text-inference" | "image-generation")[];
};

export type AstroclawProviderIndexProvider = {
  id: string;
  name: string;
  plugin: AstroclawProviderIndexPlugin;
  docs?: string;
  categories?: readonly string[];
  authChoices?: readonly AstroclawProviderIndexProviderAuthChoice[];
  previewCatalog?: ModelCatalogProvider;
};

export type AstroclawProviderIndex = {
  version: number;
  providers: Readonly<Record<string, AstroclawProviderIndexProvider>>;
};
