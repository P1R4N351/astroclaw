import type { AstroclawPluginApi } from "astroclaw/plugin-sdk/plugin-entry";

export function registerOcPathCli(api: AstroclawPluginApi): void {
  api.registerCli(
    async ({ program }) => {
      const { registerPathCli } = await import("./src/cli.js");
      registerPathCli(program);
    },
    {
      descriptors: [
        {
          name: "path",
          description: "Inspect and edit workspace files via oc:// paths",
          hasSubcommands: true,
        },
      ],
    },
  );
}
