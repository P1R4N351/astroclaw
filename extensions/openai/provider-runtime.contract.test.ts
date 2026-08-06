// Openai tests cover provider runtime.contract plugin behavior.
import { describeOpenAIProviderRuntimeContract } from "openclaw/plugin-sdk/provider-test-contracts";
import manifest from "./astroclaw.plugin.json" with { type: "json" };

describeOpenAIProviderRuntimeContract(
  () => import("./index.js"),
  manifest.modelCatalog.providers.openai,
);
