import { describeGithubCopilotProviderAuthContract } from "astroclaw/plugin-sdk/provider-test-contracts";

describeGithubCopilotProviderAuthContract(() => import("./index.js"));
