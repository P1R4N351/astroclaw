import { describeGithubCopilotProviderRuntimeContract } from "astroclaw/plugin-sdk/provider-test-contracts";

describeGithubCopilotProviderRuntimeContract(() => import("./index.js"));
