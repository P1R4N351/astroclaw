import { describeZAIProviderRuntimeContract } from "astroclaw/plugin-sdk/provider-test-contracts";

describeZAIProviderRuntimeContract(() => import("./index.js"));
