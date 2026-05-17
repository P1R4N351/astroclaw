import type { PluginRuntime } from "astroclaw/plugin-sdk/core";
import { createPluginRuntimeStore } from "astroclaw/plugin-sdk/runtime-store";

const { setRuntime: setIMessageRuntime } = createPluginRuntimeStore<PluginRuntime>({
  pluginId: "imessage",
  errorMessage: "iMessage runtime not initialized",
});
export { setIMessageRuntime };
