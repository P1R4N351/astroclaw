/**
 * Standalone MCP server for selected built-in Astroclaw tools.
 *
 * Run via: node --import tsx src/mcp/astroclaw-tools-serve.ts
 * Or: bun src/mcp/astroclaw-tools-serve.ts
 */
import { pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { AnyAgentTool } from "../agents/tools/common.js";
import { createCronTool } from "../agents/tools/cron-tool.js";
import { formatErrorMessage } from "../infra/errors.js";
import { connectToolsMcpServerToStdio, createToolsMcpServer } from "./tools-stdio-server.js";

export function resolveAstroclawToolsForMcp(): AnyAgentTool[] {
  return [createCronTool()];
}

function createAstroclawToolsMcpServer(
  params: {
    tools?: AnyAgentTool[];
  } = {},
): Server {
  const tools = params.tools ?? resolveAstroclawToolsForMcp();
  return createToolsMcpServer({ name: "astroclaw-tools", tools });
}

async function serveAstroclawToolsMcp(): Promise<void> {
  const server = createAstroclawToolsMcpServer();
  await connectToolsMcpServerToStdio(server);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  serveAstroclawToolsMcp().catch((err) => {
    process.stderr.write(`astroclaw-tools-serve: ${formatErrorMessage(err)}\n`);
    process.exit(1);
  });
}
