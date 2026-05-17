import type { WebSearchProviderPlugin } from "astroclaw/plugin-sdk/provider-web-search-contract";
import { createDuckDuckGoWebSearchProviderBase } from "./src/ddg-search-provider.shared.js";

export function createDuckDuckGoWebSearchProvider(): WebSearchProviderPlugin {
  return {
    ...createDuckDuckGoWebSearchProviderBase(),
    createTool: () => null,
  };
}
