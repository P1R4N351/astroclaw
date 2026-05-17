import { fileURLToPath } from "node:url";
import { describeGithubCopilotProviderDiscoveryContract } from "astroclaw/plugin-sdk/provider-test-contracts";

describeGithubCopilotProviderDiscoveryContract({
  load: () => import("./index.js"),
  registerRuntimeModuleId: fileURLToPath(new URL("./register.runtime.js", import.meta.url)),
});
