import { describeAnthropicProviderRuntimeContract } from "astroclaw/plugin-sdk/provider-test-contracts";

describeAnthropicProviderRuntimeContract(() => import("./index.js"));
