import { describeVeniceProviderRuntimeContract } from "astroclaw/plugin-sdk/provider-test-contracts";

describeVeniceProviderRuntimeContract(() => import("./index.js"));
