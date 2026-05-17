type McpLoopbackRuntime = {
  port: number;
  ownerToken: string;
  nonOwnerToken: string;
};

let activeRuntime: McpLoopbackRuntime | undefined;

export function getActiveMcpLoopbackRuntime(): McpLoopbackRuntime | undefined {
  return activeRuntime ? { ...activeRuntime } : undefined;
}

export function setActiveMcpLoopbackRuntime(runtime: McpLoopbackRuntime): void {
  activeRuntime = { ...runtime };
}

export function resolveMcpLoopbackBearerToken(
  runtime: McpLoopbackRuntime,
  senderIsOwner: boolean,
): string {
  return senderIsOwner ? runtime.ownerToken : runtime.nonOwnerToken;
}

export function clearActiveMcpLoopbackRuntimeByOwnerToken(ownerToken: string): void {
  if (activeRuntime?.ownerToken === ownerToken) {
    activeRuntime = undefined;
  }
}

export function createMcpLoopbackServerConfig(port: number) {
  return {
    mcpServers: {
      astroclaw: {
        type: "http",
        url: `http://127.0.0.1:${port}/mcp`,
        headers: {
          Authorization: "Bearer ${ASTROCLAW_MCP_TOKEN}",
          "x-session-key": "${ASTROCLAW_MCP_SESSION_KEY}",
          "x-astroclaw-agent-id": "${ASTROCLAW_MCP_AGENT_ID}",
          "x-astroclaw-account-id": "${ASTROCLAW_MCP_ACCOUNT_ID}",
          "x-astroclaw-message-channel": "${ASTROCLAW_MCP_MESSAGE_CHANNEL}",
          "x-astroclaw-inbound-event-kind": "${ASTROCLAW_MCP_INBOUND_EVENT_KIND}",
        },
      },
    },
  };
}
