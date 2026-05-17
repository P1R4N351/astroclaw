import { describeOpenAIProviderRuntimeContract } from "astroclaw/plugin-sdk/provider-test-contracts";

describeOpenAIProviderRuntimeContract(() => import("./index.js"));
