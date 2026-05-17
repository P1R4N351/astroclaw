import { describeOpenRouterProviderRuntimeContract } from "astroclaw/plugin-sdk/provider-test-contracts";

describeOpenRouterProviderRuntimeContract(() => import("./index.js"));
