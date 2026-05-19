import { spawn } from "node:child_process";
import { equal, ok } from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { bundledPluginFile } from "astroclaw/plugin-sdk/test-fixtures";
import { afterEach, describe, expect, it } from "vitest";

type ProxyMessage = {
  method: string;
  params: Record<string, unknown>;
};

const EXPECTED_MESSAGE_COUNT = 3;
const MAX_JSON_LINE_BYTES = 4_096;
const MAX_SCRIPT_BYTES = 4_096;
const MAX_STDOUT_BYTES = 8_192;
const MAX_TEMP_DIRS = 8;
const TEST_ENV_NAME = "CANVA_TEST_ENV";
const TEST_ENV_VALUE = "placeholder-value";

const tempDirs: string[] = [];
const proxyPath = path.resolve(bundledPluginFile("acpx", "src/runtime-internals/mcp-proxy.mjs"));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInsideDirectory(parentDir: string, candidatePath: string): boolean {
  ok(parentDir.length > 0);
  ok(candidatePath.length > 0);

  const relativePath = path.relative(parentDir, candidatePath);
  return relativePath.length > 0 && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function parseProxyMessage(line: string): ProxyMessage {
  ok(line.length > 0);
  ok(line.length <= MAX_JSON_LINE_BYTES);

  const parsed: unknown = JSON.parse(line);
  ok(isRecord(parsed));
  ok(typeof parsed.method === "string");
  ok(isRecord(parsed.params));

  return { method: parsed.method, params: parsed.params };
}

function writeJsonLine(child: ReturnType<typeof spawn>, request: Record<string, unknown>): void {
  ok(child.stdin !== null);
  ok(isRecord(request));

  const serialized = JSON.stringify(request);
  ok(serialized.length > 0);
  ok(serialized.length <= MAX_JSON_LINE_BYTES);

  const didWrite = child.stdin.write(`${serialized}\n`);
  equal(didWrite, true);
}

function endChildStdin(child: ReturnType<typeof spawn>): void {
  ok(child.stdin !== null);
  ok(child.stdin.writable);

  const endedStream = child.stdin.end();
  equal(endedStream, child.stdin);
}

function waitForClose(child: ReturnType<typeof spawn>): Promise<number | null> {
  ok(child.pid === undefined || child.pid > 0);
  ok(child.killed === false);

  // P10-RELAX(rule 3): Promise allocation is required to bridge Node's child-process close event in this test.
  return new Promise<number | null>((resolve, reject) => {
    const onError = (error: Error): void => {
      reject(error);
    };
    const onClose = (code: number | null): void => {
      const offEmitter = child.off("error", onError);
      equal(offEmitter, child);
      resolve(code);
    };

    const errorEmitter = child.once("error", onError);
    equal(errorEmitter, child);
    const closeEmitter = child.once("close", onClose);
    equal(closeEmitter, child);
  });
}

async function makeTempScript(name: string, content: string): Promise<string> {
  ok(name.length > 0);
  ok(name === path.basename(name));
  ok(content.length > 0);
  ok(content.length <= MAX_SCRIPT_BYTES);
  ok(tempDirs.length < MAX_TEMP_DIRS);

  const dir = path.resolve(await mkdtemp(path.join(os.tmpdir(), "astroclaw-acpx-mcp-proxy-")));
  const scriptPath = path.resolve(dir, name);
  ok(isInsideDirectory(dir, scriptPath));

  const dirCount = tempDirs.push(dir);
  ok(dirCount > 0);
  ok(dirCount <= MAX_TEMP_DIRS);

  await writeFile(scriptPath, content, "utf8");
  await chmod(scriptPath, 0o755);
  return scriptPath;
}

afterEach(async () => {
  ok(tempDirs.length >= 0);
  ok(tempDirs.length <= MAX_TEMP_DIRS);

  for (let index = 0; index < MAX_TEMP_DIRS; index += 1) {
    if (tempDirs.length === 0) {
      break;
    }

    const dir = tempDirs.pop();
    ok(dir !== undefined);
    ok(dir.length > 0);
    await rm(dir, { recursive: true, force: true });
  }

  equal(tempDirs.length, 0);
});

describe("mcp-proxy", () => {
  it("hides the target MCP process window on Windows only", async () => {
    const moduleUrl = pathToFileURL(proxyPath).href;
    ok(moduleUrl.startsWith("file:"));
    ok(moduleUrl.length > "file:".length);

    const { createTargetSpawnOptions } = (await import(moduleUrl)) as {
      createTargetSpawnOptions: (platform?: NodeJS.Platform) => Record<string, unknown>;
    };

    expect(createTargetSpawnOptions("win32")).toEqual({
      env: process.env,
      stdio: ["pipe", "pipe", "inherit"],
      windowsHide: true,
    });
    expect(createTargetSpawnOptions("darwin")).not.toHaveProperty("windowsHide");
    expect(createTargetSpawnOptions("linux")).not.toHaveProperty("windowsHide");
  });

  it("injects configured MCP servers into ACP session bootstrap requests", async () => {
    const cwd = process.cwd();
    ok(cwd.length > 0);
    ok(path.isAbsolute(cwd));

    const echoServerPath = await makeTempScript(
      "echo-server.cjs",
      String.raw`#!/usr/bin/env node
const { createInterface } = require("node:readline");
const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => process.stdout.write(line + "\n"));
`,
    );

    const expectedMcpServers = [
      {
        name: "canva",
        command: "npx",
        args: ["-y", "mcp-remote@latest", "https://mcp.canva.com/mcp"],
        env: [{ name: TEST_ENV_NAME, value: TEST_ENV_VALUE }],
      },
    ];
    const payloadJson = JSON.stringify({
      targetCommand: `${process.execPath} ${echoServerPath}`,
      mcpServers: expectedMcpServers,
    });
    ok(payloadJson.length > 0);
    ok(payloadJson.length <= MAX_JSON_LINE_BYTES);

    const payload = Buffer.from(payloadJson, "utf8").toString("base64url");
    ok(payload.length > 0);
    ok(payload.length <= MAX_JSON_LINE_BYTES);

    const child = spawn(process.execPath, [proxyPath, "--payload", payload], {
      stdio: ["pipe", "pipe", "inherit"],
      cwd,
    });
    ok(child.stdin !== null);
    ok(child.stdout !== null);

    let stdout = "";
    const stdoutEmitter = child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      ok(stdout.length <= MAX_STDOUT_BYTES);
    });
    equal(stdoutEmitter, child.stdout);

    writeJsonLine(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "session/new",
      params: { cwd, mcpServers: [] },
    });
    writeJsonLine(child, {
      jsonrpc: "2.0",
      id: 2,
      method: "session/load",
      params: { cwd, sessionId: "sid-1", mcpServers: [] },
    });
    writeJsonLine(child, {
      jsonrpc: "2.0",
      id: 3,
      method: "session/prompt",
      params: { sessionId: "sid-1", prompt: [{ type: "text", text: "hello" }] },
    });
    endChildStdin(child);

    const exitCode = await waitForClose(child);
    expect(exitCode).toBe(0);

    const trimmedStdout = stdout.trim();
    ok(trimmedStdout.length > 0);
    ok(trimmedStdout.length <= MAX_STDOUT_BYTES);

    const rawLines = trimmedStdout.split(/\r?\n/);
    expect(rawLines).toHaveLength(EXPECTED_MESSAGE_COUNT);

    const lines: ProxyMessage[] = [];
    for (let index = 0; index < EXPECTED_MESSAGE_COUNT; index += 1) {
      const line = rawLines[index];
      ok(line !== undefined);
      lines.push(parseProxyMessage(line));
    }

    expect(lines[0].params.mcpServers).toEqual(expectedMcpServers);
    expect(lines[1].params.mcpServers).toEqual(lines[0].params.mcpServers);
    expect(lines[2].method).toBe("session/prompt");
    expect(lines[2].params.mcpServers).toBeUndefined();
  });
});
