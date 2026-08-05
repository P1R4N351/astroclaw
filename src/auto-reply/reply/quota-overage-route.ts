import { readFileSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";

const OPENROUTER_PROVIDER = "openrouter";
const OPENROUTER_MODEL = "anthropic/claude-opus-5";
const MAX_FILE_BYTES = 65_536;
const MAX_PROVIDERS = 50;
const MAX_SOURCE_AGE_MS = 1_800_000;
const MAX_FUTURE_SKEW_MS = 60_000;
const CACHE_TTL_MS = 5_000;

type QuotaProvider = { forced_open?: boolean };
type QuotaSnapshot = {
  providers: Record<string, QuotaProvider>;
  source_fetched_at: string;
};

type QuotaRouteConfig = {
  auth?: { order?: Record<string, string[]> };
};

type QuotaRoute = {
  provider: typeof OPENROUTER_PROVIDER;
  model: typeof OPENROUTER_MODEL;
};

let cachedPath = "";
let cachedAtMs = 0;
let cachedMtimeMs = -1;
let cachedSnapshot: QuotaSnapshot | null = null;

function snapshotIdForProfile(provider: string, profileId: string): string | undefined {
  const known: Record<string, string> = {
    "anthropic\0anthropic-piranesi-own:default": "anthropic_piranesi",
    "anthropic\0anthropic:sat-oauth": "anthropic_sat",
    "github-copilot\0github-copilot:piranesi": "github_piranesi",
    "github-copilot\0github-copilot:sat": "github_sat",
  };
  return known[`${provider}\0${profileId}`];
}

function selectedProfileId(params: {
  provider: string;
  authProfileId?: string;
  config: QuotaRouteConfig;
}): string | undefined {
  if (params.authProfileId) {
    return params.authProfileId;
  }
  const ordered = params.config.auth?.order?.[params.provider];
  return Array.isArray(ordered) ? ordered[0] : undefined;
}

function parseSnapshot(raw: string, nowMs: number): QuotaSnapshot | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Partial<QuotaSnapshot>;
  if (!record.providers || typeof record.providers !== "object") {
    return null;
  }
  const providerKeys = Object.keys(record.providers);
  if (providerKeys.length > MAX_PROVIDERS || typeof record.source_fetched_at !== "string") {
    return null;
  }
  const fetchedMs = Date.parse(record.source_fetched_at);
  const ageMs = nowMs - fetchedMs;
  if (!Number.isFinite(fetchedMs) || ageMs > MAX_SOURCE_AGE_MS || ageMs < -MAX_FUTURE_SKEW_MS) {
    return null;
  }
  return record as QuotaSnapshot;
}

function readSnapshot(path: string, nowMs: number): QuotaSnapshot | null {
  if (!path || !isAbsolute(path)) {
    return null;
  }
  if (path === cachedPath && nowMs - cachedAtMs < CACHE_TTL_MS) {
    return cachedSnapshot;
  }
  try {
    const stat = statSync(path);
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_FILE_BYTES) {
      return null;
    }
    if (path === cachedPath && stat.mtimeMs === cachedMtimeMs) {
      cachedAtMs = nowMs;
      return cachedSnapshot;
    }
    const snapshot = parseSnapshot(readFileSync(path, "utf8"), nowMs);
    cachedPath = path;
    cachedAtMs = nowMs;
    cachedMtimeMs = stat.mtimeMs;
    cachedSnapshot = snapshot;
    return snapshot;
  } catch {
    return null;
  }
}

export function resolveQuotaOverageRoute(params: {
  provider: string;
  authProfileId?: string;
  config: QuotaRouteConfig;
  quotaFile?: string;
  nowMs?: number;
}): QuotaRoute | undefined {
  if (params.provider !== "anthropic" && params.provider !== "github-copilot") {
    return undefined;
  }
  const profileId = selectedProfileId(params);
  const snapshotId = profileId ? snapshotIdForProfile(params.provider, profileId) : undefined;
  if (!snapshotId) {
    return undefined;
  }
  const quotaFile = params.quotaFile ?? process.env.ASTROCLAW_QUOTA_OVERRIDES_FILE ?? "";
  const snapshot = readSnapshot(quotaFile, params.nowMs ?? Date.now());
  if (snapshot?.providers[snapshotId]?.forced_open !== true) {
    return undefined;
  }
  return { provider: OPENROUTER_PROVIDER, model: OPENROUTER_MODEL };
}

export function resetQuotaOverageRouteCacheForTest(): void {
  cachedPath = "";
  cachedAtMs = 0;
  cachedMtimeMs = -1;
  cachedSnapshot = null;
}
