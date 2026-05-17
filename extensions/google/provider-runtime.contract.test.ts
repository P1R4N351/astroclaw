import { describeGoogleProviderRuntimeContract } from "astroclaw/plugin-sdk/provider-test-contracts";

describeGoogleProviderRuntimeContract(() => import("./index.js"));
