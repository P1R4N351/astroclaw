import { ok, strictEqual } from "node:assert/strict";
import { createRuntimeEnv } from "astroclaw/plugin-sdk/plugin-test-runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { AstroclawConfig, PluginRuntime, ResolvedLineAccount } from "../api.js";
import { lineGatewayAdapter } from "./gateway.js";
import { setLineRuntime } from "./runtime.js";

const DEFAULT_ACCOUNT_ID = "default";
const CONFIG_TOKEN_SOURCE: ResolvedLineAccount["tokenSource"] = "config";
const NO_TOKEN_SOURCE: ResolvedLineAccount["tokenSource"] = "none";

type LineAccountConfig = {
  readonly tokenFile?: string;
  readonly secretFile?: string;
  readonly channelAccessToken?: string;
  readonly channelSecret?: string;
  readonly name?: string;
};

type LineChannelConfig = LineAccountConfig & {
  readonly accounts?: Readonly<Record<string, LineAccountConfig>>;
};

const EMPTY_LINE_ACCOUNT_CONFIG: LineAccountConfig = Object.freeze({});
const EMPTY_LINE_CHANNEL_CONFIG: LineChannelConfig = Object.freeze({});

type ReplaceConfigFileFn = () => Promise<void>;

type ResolveLineAccountParams = {
  readonly cfg: AstroclawConfig;
  readonly accountId?: string;
};

type ResolveLineAccountFn = (params: ResolveLineAccountParams) => ResolvedLineAccount;

type LineRuntimeMocks = {
  readonly replaceConfigFile: Mock<ReplaceConfigFileFn>;
  readonly resolveLineAccount: Mock<ResolveLineAccountFn>;
};

type LogoutAccount = NonNullable<typeof lineGatewayAdapter.logoutAccount>;

type LogoutScenarioParams = {
  readonly cfg: AstroclawConfig;
  readonly accountId: string;
};

type LogoutScenarioResult = {
  readonly result: Awaited<ReturnType<LogoutAccount>>;
  readonly mocks: LineRuntimeMocks;
};

function assertAccountId(accountId: string): void {
  strictEqual(typeof accountId, "string", "accountId must be a string");
  ok(accountId.length > 0, "accountId must not be empty");
}

function readLineConfig(cfg: AstroclawConfig): LineChannelConfig {
  ok(cfg, "cfg must be defined");
  strictEqual(typeof cfg, "object", "cfg must be an object");

  const lineConfig = cfg.channels?.line;
  if (!lineConfig) {
    return EMPTY_LINE_CHANNEL_CONFIG;
  }

  return lineConfig as LineChannelConfig;
}

function selectLineAccountConfig(cfg: AstroclawConfig, accountId: string): LineAccountConfig {
  ok(cfg, "cfg must be defined");
  assertAccountId(accountId);

  const lineConfig = readLineConfig(cfg);
  if (accountId === DEFAULT_ACCOUNT_ID) {
    return lineConfig;
  }

  return lineConfig.accounts?.[accountId] ?? EMPTY_LINE_ACCOUNT_CONFIG;
}

function hasLineCredentials(entry: LineAccountConfig): boolean {
  ok(entry, "entry must be defined");
  strictEqual(typeof entry, "object", "entry must be an object");

  const hasToken = Boolean(entry.channelAccessToken) || Boolean(entry.tokenFile);
  const hasSecret = Boolean(entry.channelSecret) || Boolean(entry.secretFile);

  return hasToken && hasSecret;
}

function buildResolvedLineAccount(cfg: AstroclawConfig, accountId: string): ResolvedLineAccount {
  ok(cfg, "cfg must be defined");
  assertAccountId(accountId);

  const entry = selectLineAccountConfig(cfg, accountId);
  const tokenSource = hasLineCredentials(entry) ? CONFIG_TOKEN_SOURCE : NO_TOKEN_SOURCE;

  return { tokenSource } as ResolvedLineAccount;
}

function requireLogoutAccount(): LogoutAccount {
  ok(lineGatewayAdapter.logoutAccount, "logoutAccount must be registered");
  strictEqual(typeof lineGatewayAdapter.logoutAccount, "function", "logoutAccount must be callable");

  return lineGatewayAdapter.logoutAccount;
}

function createRuntime(): { readonly runtime: PluginRuntime; readonly mocks: LineRuntimeMocks } {
  const replaceConfigFile = vi.fn<ReplaceConfigFileFn>(async () => undefined);
  const resolveLineAccount = vi.fn<ResolveLineAccountFn>(({ cfg, accountId }) => {
    ok(cfg, "cfg must be defined");
    ok(accountId, "accountId must be defined");

    return buildResolvedLineAccount(cfg, accountId);
  });

  const runtime = {
    config: { replaceConfigFile },
  } as unknown as PluginRuntime;

  ok(runtime, "runtime must be created");
  strictEqual(typeof runtime, "object", "runtime must be an object");

  return { runtime, mocks: { replaceConfigFile, resolveLineAccount } };
}

async function runLogoutScenario(params: LogoutScenarioParams): Promise<LogoutScenarioResult> {
  ok(params, "params must be defined");
  ok(params.cfg, "params.cfg must be defined");
  assertAccountId(params.accountId);

  const { runtime, mocks } = createRuntime();
  void setLineRuntime(runtime);

  const account = mocks.resolveLineAccount({ cfg: params.cfg, accountId: params.accountId });
  ok(account, "resolved account must be defined");
  strictEqual(typeof account, "object", "resolved account must be an object");

  const logoutAccount = requireLogoutAccount();
  const pluginRuntime = createRuntimeEnv();
  ok(pluginRuntime, "plugin runtime must be defined");
  strictEqual(typeof pluginRuntime, "object", "plugin runtime must be an object");

  const result = await logoutAccount({
    accountId: params.accountId,
    cfg: params.cfg,
    account,
    runtime: pluginRuntime,
  });
  ok(result, "logout result must be defined");
  strictEqual(typeof result.loggedOut, "boolean", "loggedOut must be a boolean");

  return { result, mocks };
}

describe("linePlugin gateway.logoutAccount", () => {
  beforeEach(() => {
    const { runtime } = createRuntime();
    void setLineRuntime(runtime);
  });

  it("clears tokenFile/secretFile on default account logout", async () => {
    const cfg: AstroclawConfig = {
      channels: {
        line: {
          tokenFile: "/tmp/token",
          secretFile: "/tmp/secret",
        },
      },
    };
    const { result, mocks } = await runLogoutScenario({
      cfg,
      accountId: DEFAULT_ACCOUNT_ID,
    });

    expect(result.cleared).toBe(true);
    expect(result.loggedOut).toBe(true);
    expect(mocks.replaceConfigFile).toHaveBeenCalledWith({
      nextConfig: {},
      afterWrite: { mode: "auto" },
    });
  });

  it("clears tokenFile/secretFile on account logout", async () => {
    const cfg: AstroclawConfig = {
      channels: {
        line: {
          accounts: {
            primary: {
              tokenFile: "/tmp/token",
              secretFile: "/tmp/secret",
            },
          },
        },
      },
    };
    const { result, mocks } = await runLogoutScenario({
      cfg,
      accountId: "primary",
    });

    expect(result.cleared).toBe(true);
    expect(result.loggedOut).toBe(true);
    expect(mocks.replaceConfigFile).toHaveBeenCalledWith({
      nextConfig: {},
      afterWrite: { mode: "auto" },
    });
  });

  it("does not write config when account has no token/secret fields", async () => {
    const cfg: AstroclawConfig = {
      channels: {
        line: {
          accounts: {
            primary: {
              name: "Primary",
            },
          },
        },
      },
    };
    const { result, mocks } = await runLogoutScenario({
      cfg,
      accountId: "primary",
    });

    expect(result.cleared).toBe(false);
    expect(result.loggedOut).toBe(true);
    expect(mocks.replaceConfigFile).not.toHaveBeenCalled();
  });
});
