import { describeModelStudioProviderDiscoveryContract } from "astroclaw/plugin-sdk/provider-test-contracts";

describeModelStudioProviderDiscoveryContract(() => import("./index.js"));
