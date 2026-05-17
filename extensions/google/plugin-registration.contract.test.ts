import { pluginRegistrationContractCases } from "astroclaw/plugin-sdk/plugin-test-contracts";
import { describePluginRegistrationContract } from "astroclaw/plugin-sdk/plugin-test-contracts";

describePluginRegistrationContract({
  ...pluginRegistrationContractCases.google,
  speechProviderIds: ["google"],
  videoGenerationProviderIds: ["google"],
  webSearchProviderIds: ["gemini"],
  requireDescribeImages: true,
  requireGenerateImage: true,
  requireGenerateVideo: true,
});
