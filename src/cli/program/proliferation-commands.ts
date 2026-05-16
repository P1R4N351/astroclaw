import type { Command } from "commander";

export type ProliferationCommandHandler = (argv: string[]) => Promise<number> | number;

interface ProliferationCommandEntry {
  name: string;
  description: string;
  handler: ProliferationCommandHandler;
}

const registry = new Map<string, ProliferationCommandEntry>();

/**
 * Sidecar-facing API. Called by `@astroclaw/runtime` during init to register
 * subcommands accessible as `astroclaw prolif <name>`. Idempotent on name;
 * later registrations replace earlier ones.
 *
 * No-op when the sidecar is absent — the registry simply stays empty and
 * `astroclaw prolif` reports no available subcommands.
 */
export function registerProliferationCommand(entry: ProliferationCommandEntry): void {
  registry.set(entry.name, entry);
}

export function unregisterProliferationCommand(name: string): void {
  registry.delete(name);
}

export function clearProliferationCommands(): void {
  registry.clear();
}

/**
 * Called from registerProgramCommands(). Attaches `astroclaw prolif <name>`
 * to the program. When the registry is empty (sidecar absent or inactive),
 * `astroclaw prolif` lists the empty registry and exits 0 — no hard error.
 */
export function registerProliferationCli(program: Command): void {
  const prolif = program.command("prolif").description("Astroclaw proliferation sidecar commands.");
  prolif.action(() => {
    const entries = Array.from(registry.values());
    if (entries.length === 0) {
      process.stdout.write(
        "no proliferation subcommands registered (sidecar may be inactive or not installed)\n",
      );
      return;
    }
    process.stdout.write("available proliferation subcommands:\n");
    for (const entry of entries) {
      process.stdout.write(`  ${entry.name.padEnd(20)} ${entry.description}\n`);
    }
  });
  prolif
    .command("run <name> [args...]")
    .description("Invoke a registered proliferation subcommand.")
    .action(async (name: string, args: string[]) => {
      const entry = registry.get(name);
      if (!entry) {
        process.stderr.write(`prolif: unknown subcommand '${name}'\n`);
        process.exit(1);
      }
      const exit = await entry.handler(args);
      process.exit(exit);
    });
}
