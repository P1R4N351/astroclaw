import { buildManifestModelProviderConfig } from "astroclaw/plugin-sdk/provider-catalog-shared";
import type { ModelProviderConfig } from "astroclaw/plugin-sdk/provider-model-shared";
import manifest from "./astroclaw.plugin.json" with { type: "json" };

export const QIANFAN_BASE_URL = "https://qianfan.baidubce.com/v2";
export const QIANFAN_DEFAULT_MODEL_ID = "deepseek-v3.2";

export function buildQianfanProvider(): ModelProviderConfig {
  return buildManifestModelProviderConfig({
    providerId: "qianfan",
    catalog: manifest.modelCatalog.providers.qianfan,
  });
}
