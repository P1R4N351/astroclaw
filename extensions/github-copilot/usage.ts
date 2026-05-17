import { buildCopilotIdeHeaders } from "astroclaw/plugin-sdk/provider-auth";
import {
  buildUsageHttpErrorSnapshot,
  fetchJson,
  clampPercent,
  PROVIDER_LABELS,
  type ProviderUsageSnapshot,
  type UsageWindow,
} from "astroclaw/plugin-sdk/provider-usage";

type CopilotQuotaSnapshot = {
  percent_remaining?: number | null;
  unlimited?: boolean;
};

type CopilotUsageResponse = {
  quota_snapshots?: {
    premium_interactions?: CopilotQuotaSnapshot;
    chat?: CopilotQuotaSnapshot;
    completions?: CopilotQuotaSnapshot;
  };
  quota_reset_date?: string;
  copilot_plan?: string;
};

function parseResetAt(value: unknown): number | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

// Build a UsageWindow for a Copilot quota snapshot, or skip it when the
// snapshot is missing, flagged unlimited, or has no usable percent.
// Unlimited quotas (chat/completions on paid plans, premium on enterprise)
// would otherwise render as a misleading 0%-used bar; null/non-finite
// percentages are unknown, not full.
function buildWindow(
  label: string,
  snapshot: CopilotQuotaSnapshot | undefined,
  resetAt: number | undefined,
): UsageWindow | undefined {
  if (!snapshot || snapshot.unlimited === true) {
    return undefined;
  }
  const remaining = snapshot.percent_remaining;
  if (typeof remaining !== "number" || !Number.isFinite(remaining)) {
    return undefined;
  }
  const window: UsageWindow = {
    label,
    usedPercent: clampPercent(100 - remaining),
  };
  if (resetAt !== undefined) {
    window.resetAt = resetAt;
  }
  return window;
}

export async function fetchCopilotUsage(
  token: string,
  timeoutMs: number,
  fetchFn: typeof fetch,
): Promise<ProviderUsageSnapshot> {
  const res = await fetchJson(
    "https://api.github.com/copilot_internal/user",
    {
      headers: {
        Authorization: `token ${token}`,
        ...buildCopilotIdeHeaders({ includeApiVersion: true }),
      },
    },
    timeoutMs,
    fetchFn,
  );

  if (!res.ok) {
    let message: string | undefined;
    try {
      const data = (await res.json()) as { message?: unknown };
      const raw = data?.message;
      if (typeof raw === "string" && raw.trim()) {
        message = raw.trim();
      }
    } catch {
      // ignore parse errors
    }
    return buildUsageHttpErrorSnapshot({
      provider: "github-copilot",
      status: res.status,
      message,
      tokenExpiredStatuses: [401, 403],
    });
  }

  const data = (await res.json()) as CopilotUsageResponse;
  const resetAt = parseResetAt(data.quota_reset_date);
  const windows: UsageWindow[] = [];

  for (const [label, snapshot] of [
    ["Premium", data.quota_snapshots?.premium_interactions],
    ["Chat", data.quota_snapshots?.chat],
    ["Completions", data.quota_snapshots?.completions],
  ] as const) {
    const window = buildWindow(label, snapshot, resetAt);
    if (window) {
      windows.push(window);
    }
  }

  return {
    provider: "github-copilot",
    displayName: PROVIDER_LABELS["github-copilot"],
    windows,
    plan: data.copilot_plan,
  };
}
