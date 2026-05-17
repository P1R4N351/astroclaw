import { buildManifestModelProviderConfig } from "astroclaw/plugin-sdk/provider-catalog-shared";
import type { ModelProviderConfig } from "astroclaw/plugin-sdk/provider-model-shared";
import manifest from "./astroclaw.plugin.json" with { type: "json" };

export function buildMistralProvider(): ModelProviderConfig {
  return buildManifestModelProviderConfig({
    providerId: "mistral",
    catalog: manifest.modelCatalog.providers.mistral,
  });
}
