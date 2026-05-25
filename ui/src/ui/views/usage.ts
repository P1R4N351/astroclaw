import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { getUsageCacheRefreshTitle } from "../usage-cache-status.ts";
import { formatCost, formatIsoDate, formatTokens } from "./usage-metrics.ts";
import type {
  SessionLogEntry,
  SessionLogRole,
  UsageColumnId,
  UsageFilterState,
  UsageProps,
  UsageTotals,
} from "./usageTypes.ts";

export type { UsageColumnId, SessionLogEntry, SessionLogRole };

function createEmptyUsageTotals(): UsageTotals {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    totalCost: 0,
    inputCost: 0,
    outputCost: 0,
    cacheReadCost: 0,
    cacheWriteCost: 0,
    missingCostEntries: 0,
  };
}

function addUsageTotals(
  acc: UsageTotals,
  usage: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    totalTokens: number;
    totalCost: number;
    inputCost?: number;
    outputCost?: number;
    cacheReadCost?: number;
    cacheWriteCost?: number;
    missingCostEntries?: number;
  },
): UsageTotals {
  acc.input += usage.input;
  acc.output += usage.output;
  acc.cacheRead += usage.cacheRead;
  acc.cacheWrite += usage.cacheWrite;
  acc.totalTokens += usage.totalTokens;
  acc.totalCost += usage.totalCost;
  acc.inputCost += usage.inputCost ?? 0;
  acc.outputCost += usage.outputCost ?? 0;
  acc.cacheReadCost += usage.cacheReadCost ?? 0;
  acc.cacheWriteCost += usage.cacheWriteCost ?? 0;
  acc.missingCostEntries += usage.missingCostEntries ?? 0;
  return acc;
}

function renderUsageLoadingState(filters: UsageFilterState) {
  return html`
    <section class="card usage-loading-card">
      <div class="usage-loading-header">
        <div class="usage-loading-title-group">
          <div class="card-title usage-section-title">${t("usage.loading.title")}</div>
          <span class="usage-loading-badge">
            <span class="usage-loading-spinner" aria-hidden="true"></span>
            ${t("usage.loading.badge")}
          </span>
        </div>
        <div class="usage-loading-controls">
          <div class="usage-date-range usage-date-range--loading">
            <input class="usage-date-input" type="date" .value=${filters.startDate} disabled />
            <span class="usage-separator">${t("usage.filters.to")}</span>
            <input class="usage-date-input" type="date" .value=${filters.endDate} disabled />
          </div>
        </div>
      </div>
      <div class="usage-loading-grid">
        <div class="usage-skeleton-block usage-skeleton-block--tall"></div>
        <div class="usage-skeleton-block"></div>
        <div class="usage-skeleton-block"></div>
      </div>
    </section>
  `;
}

function renderUsageEmptyState(onRefresh: () => void) {
  return html`
    <section class="card usage-empty-state">
      <div class="usage-empty-state__title">${t("usage.empty.title")}</div>
      <div class="card-sub usage-empty-state__subtitle">${t("usage.empty.subtitle")}</div>
      <div class="usage-empty-state__features">
        <span class="usage-empty-state__feature">${t("usage.empty.featureOverview")}</span>
        <span class="usage-empty-state__feature">${t("usage.empty.featureSessions")}</span>
        <span class="usage-empty-state__feature">${t("usage.empty.featureTimeline")}</span>
      </div>
      <div class="usage-empty-state__actions">
        <button class="btn primary" @click=${onRefresh}>${t("common.refresh")}</button>
      </div>
    </section>
  `;
}

// stripped-down renderUsage. The full filter chips,
// mosaic, time-series detail, per-session log viewer, and CSV export
// surfaces were replaced with a minimal totals + top-sessions layout
// per Sat's "strip down usage page" directive. The helper functions
// (createEmptyUsageTotals, addUsageTotals, renderUsageLoadingState,
// renderUsageEmptyState) above stay because they're still used by
// this minimal layout. The deeper helpers imported from
// usage-render-overview / usage-render-details / usage-query stay
// defined in their respective modules but are no longer referenced
// from this file — operators who need the full breakdown can run
// `astroclaw usage` (CLI) which renders the same data without the UI
// chrome.
export function renderUsage(props: UsageProps) {
  const { data, filters, display, callbacks } = props;
  const filterActions = callbacks.filters;
  const displayActions = callbacks.display;

  if (data.loading && !data.totals) {
    return html`<div class="usage-page">${renderUsageLoadingState(filters)}</div>`;
  }
  if (!data.loading && !data.totals && data.sessions.length === 0) {
    return html`<div class="usage-page">${renderUsageEmptyState(filterActions.onRefresh)}</div>`;
  }

  const isTokenMode = display.chartMode === "tokens";
  const sortedSessions = [...data.sessions].toSorted((a, b) => {
    const valA = isTokenMode ? (a.usage?.totalTokens ?? 0) : (a.usage?.totalCost ?? 0);
    const valB = isTokenMode ? (b.usage?.totalTokens ?? 0) : (b.usage?.totalCost ?? 0);
    return valB - valA;
  });
  const topSessions = sortedSessions.slice(0, 25);

  const totals: UsageTotals =
    data.totals ??
    sortedSessions.reduce(
      (acc, s) => (s.usage ? addUsageTotals(acc, s.usage) : acc),
      createEmptyUsageTotals(),
    );

  const datePresets = [
    { label: t("usage.presets.today"), days: 1 },
    { label: t("usage.presets.last7d"), days: 7 },
    { label: t("usage.presets.last30d"), days: 30 },
    { label: t("usage.presets.last90d"), days: 90 },
  ];
  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    filterActions.onStartDateChange(formatIsoDate(start));
    filterActions.onEndDateChange(formatIsoDate(end));
  };

  const cacheStatusTitle = getUsageCacheRefreshTitle(data.cacheStatus);

  return html`
    <div class="usage-page">
      <section class="card">
        <div class="row" style="justify-content: space-between; align-items: center; gap: 12px;">
          <div>
            <div class="card-title">${t("usage.title") || "Usage"}</div>
            <div class="card-sub">${filters.startDate} → ${filters.endDate}</div>
          </div>
          <div class="row" style="gap: 6px; flex-wrap: wrap;">
            ${datePresets.map(
              (p) => html`
                <button class="btn btn--sm" @click=${() => applyPreset(p.days)}>${p.label}</button>
              `,
            )}
            <button
              class="btn btn--sm"
              @click=${filterActions.onRefresh}
              title=${cacheStatusTitle ?? ""}
            >
              ${data.loading ? t("common.loading") : t("common.refresh")}
            </button>
          </div>
        </div>

        <div
          class="grid"
          style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-top: 16px;"
        >
          <div class="card" style="padding: 12px;">
            <div class="card-sub">Total tokens</div>
            <div class="card-title" style="font-size: 1.4em;">
              ${formatTokens(totals.totalTokens)}
            </div>
            <div class="muted" style="font-size: 0.8em; margin-top: 4px;">
              in ${formatTokens(totals.input)} · out ${formatTokens(totals.output)}
              ${totals.cacheRead + totals.cacheWrite > 0
                ? html` · cache ${formatTokens(totals.cacheRead + totals.cacheWrite)}`
                : nothing}
            </div>
          </div>
          <div class="card" style="padding: 12px;">
            <div class="card-sub">Total cost</div>
            <div class="card-title" style="font-size: 1.4em;">${formatCost(totals.totalCost)}</div>
            ${totals.missingCostEntries > 0
              ? html`<div class="muted" style="font-size: 0.8em; margin-top: 4px;">
                  ${totals.missingCostEntries} session(s) missing cost data
                </div>`
              : nothing}
          </div>
          <div class="card" style="padding: 12px;">
            <div class="card-sub">Sessions</div>
            <div class="card-title" style="font-size: 1.4em;">${sortedSessions.length}</div>
            ${data.sessionsLimitReached
              ? html`<div class="muted" style="font-size: 0.8em; margin-top: 4px;">
                  capped at 1000 — narrow the date range for the full count
                </div>`
              : nothing}
          </div>
        </div>

        <div class="row" style="margin-top: 16px; gap: 6px;">
          <button
            class="btn btn--sm ${isTokenMode ? "primary" : ""}"
            @click=${() => displayActions.onChartModeChange("tokens")}
          >
            Tokens
          </button>
          <button
            class="btn btn--sm ${isTokenMode ? "" : "primary"}"
            @click=${() => displayActions.onChartModeChange("cost")}
          >
            Cost
          </button>
        </div>

        <div style="margin-top: 16px;">
          <div class="card-title" style="font-size: 0.95em;">
            Top sessions (${topSessions.length}/${sortedSessions.length})
          </div>
          ${topSessions.length === 0
            ? html`<div class="muted" style="margin-top: 8px;">No sessions in range.</div>`
            : html`
                <table style="width: 100%; margin-top: 8px; border-collapse: collapse;">
                  <thead>
                    <tr style="text-align: left; font-size: 0.85em; opacity: 0.7;">
                      <th style="padding: 6px 4px;">Session</th>
                      <th style="padding: 6px 4px;">Agent · Channel</th>
                      <th style="padding: 6px 4px;">Model</th>
                      <th style="padding: 6px 4px; text-align: right;">
                        ${isTokenMode ? "Tokens" : "Cost"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    ${topSessions.map(
                      (s) => html`
                        <tr style="border-top: 1px solid var(--surface-2, #f4f4f5);">
                          <td style="padding: 6px 4px;">
                            <code style="font-size: 0.8em;">${s.key}</code>
                          </td>
                          <td style="padding: 6px 4px;">
                            ${s.agentId ?? ""}${s.channel ? html` · ${s.channel}` : nothing}
                          </td>
                          <td style="padding: 6px 4px;">${s.model ?? ""}</td>
                          <td style="padding: 6px 4px; text-align: right;">
                            ${isTokenMode
                              ? formatTokens(s.usage?.totalTokens ?? 0)
                              : formatCost(s.usage?.totalCost ?? 0)}
                          </td>
                        </tr>
                      `,
                    )}
                  </tbody>
                </table>
              `}
        </div>

        ${data.error
          ? html`<div class="callout danger" style="margin-top: 16px;">${data.error}</div>`
          : nothing}
      </section>
    </div>
  `;
}

// Exposed for Playwright/Vitest browser unit tests.
