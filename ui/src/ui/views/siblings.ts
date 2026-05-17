import { html, nothing, type TemplateResult } from "lit";
import { t } from "../../i18n/index.ts";
import { formatRelativeTimestamp } from "../format.ts";
import { formatPresenceAge } from "../presenter.ts";
import type { PresenceEntry } from "../types.ts";

/**
 * Siblings view — surfaces the mesh state exposed by the astroclaw sidecar's
 * /healthz `proliferation` block. When proliferation is inactive (sidecar
 * absent, or `enabled: false`), shows a gentle inactive state explaining
 * how to enable.
 *
 * The view fetches /healthz directly via the gateway request controller
 * passed in `props`. Refresh is operator-driven (no auto-polling) so the
 * tab is cheap to leave open.
 */

export type ProliferationSiblingNode = {
  id: string;
  substrate: string;
  trust_zone: string;
  is_identity_anchor?: boolean;
  uptime_ms?: number;
};

export type ProliferationHealth = {
  version?: string;
  node?: ProliferationSiblingNode;
  mesh?: {
    member_count: number;
    members: string[];
  };
  postgres?: {
    connected: boolean;
    configured: boolean;
  };
  leases?: {
    held: string[];
  };
  heartbeat?: {
    last_tick_at_ms: number;
    tick_seq: number;
    gap_ms: number;
  };
  events_observed?: Record<string, number>;
  channel_sends_allowed?: number;
  workspace_replications_applied?: number;
  session_snapshots_recorded?: number;
  session_snapshot_body_cid_populated?: number;
  replication?: {
    peers: number;
    lag_ms: number;
  };
  /**
   * astroclaw/0025: eidetic warm-spare + snapshot pipeline state. Optional so
   * phase-1 (in-memory) and pre-phase-3 (cron-puller, no sidecar surface)
   * deploys render nothing. After phase-3 cutover the same shape is
   * populated by the logical-replica side of proliferation-postgres.
   */
  eidetic?: {
    role: string;
    endpoint?: string;
    lag_ms?: number;
    last_pull_at_ms?: number;
    snapshots?: {
      count: number;
      last_at_ms?: number;
      last_bytes?: number;
    };
    pgvector?: {
      embeddings: number;
      dimensions?: number;
    };
    dispatch_queue?: {
      pending: number;
      in_flight: number;
    };
  };
};

export type SiblingsProps = {
  loading: boolean;
  error?: string | null;
  proliferation?: ProliferationHealth | null;
  onRefresh: () => void;
  /**
   * astroclaw/0020: paired astroclaw nodes (was the canonical content of
   * the dedicated Nodes page). When provided, renders below the mesh
   * grid as a "Paired nodes" card. Optional so callers that only
   * have proliferation data (e.g. healthz-only deployments) still
   * compile.
   */
  pairedNodes?: Array<Record<string, unknown>>;
  pairedNodesLoading?: boolean;
  onPairedNodesRefresh?: () => void;
  /**
   * astroclaw/0027: connected instances (presence entries — chat clients,
   * mobile, glasses, scripts holding an active gateway session). Was
   * the canonical content of the dedicated Instances page. When
   * provided, renders below the paired-nodes card as a "Connected
   * instances" card. Optional so callers without presence state still
   * compile.
   */
  connectedInstances?: PresenceEntry[];
  connectedInstancesLoading?: boolean;
  connectedInstancesError?: string | null;
  connectedInstancesStatus?: string | null;
  onConnectedInstancesRefresh?: () => void;
};

export function renderSiblings(props: SiblingsProps): TemplateResult {
  if (!props.proliferation) {
    return html`
      <section class="card">
        <div class="card-title">${t("tabs.siblings")}</div>
        <div class="card-sub">${t("subtitles.siblings")}</div>
        <div class="muted" style="margin-top: 16px;">
          Proliferation sidecar is not active on this gateway.
          ${props.error ? html` <span class="error"> ${props.error}</span>` : nothing}
        </div>
        <pre
          style="margin-top: 12px; padding: 12px; background: var(--surface-2, #f4f4f5); border-radius: 6px; overflow: auto;"
        ><code>// In astroclaw.json:
"proliferation": {
  "enabled": true,
  "nodeId": "this-host",
  "substrate": "piranesi",
  "trustZone": "primary",
  "postgresUrl": "postgres://..." // phase-2 only
}</code></pre>
        <div class="row" style="margin-top: 12px;">
          <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
            ${props.loading ? t("common.loading") : t("common.refresh")}
          </button>
        </div>
      </section>
    `;
  }

  const p = props.proliferation;
  const node = p.node;
  const mesh = p.mesh ?? { member_count: 0, members: [] };
  const leases = p.leases?.held ?? [];
  const heartbeat = p.heartbeat;
  const events = p.events_observed ?? {};
  const isPhase2 = p.version === "phase-2-postgres";

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="card-title">
            ${t("tabs.siblings")}
            <span
              class="badge"
              style="margin-left: 8px; padding: 2px 8px; border-radius: 999px; background: ${isPhase2
                ? "#86efac"
                : "#fde68a"}; color: #052e16; font-size: 0.75em;"
            >
              ${p.version ?? "active"}
            </span>
          </div>
          <div class="card-sub">${t("subtitles.siblings")}</div>
        </div>
        <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
          ${props.loading ? t("common.loading") : t("common.refresh")}
        </button>
      </div>

      <div
        class="grid"
        style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px;"
      >
        ${node ? renderThisNode(node) : nothing} ${renderMesh(mesh, node?.id)}
        ${renderLeases(leases)} ${renderHeartbeat(heartbeat)}
        ${renderReplication(p.postgres, p.replication)}
        ${renderEvents(events, p.channel_sends_allowed)}
        ${renderReplicationActivity({
          workspaceReplications: p.workspace_replications_applied,
          sessionSnapshots: p.session_snapshots_recorded,
          snapshotBodiesPushed: p.session_snapshot_body_cid_populated,
        })}
        ${renderEidetic(p.eidetic)}
      </div>
      ${renderPairedNodes(
        props.pairedNodes,
        Boolean(props.pairedNodesLoading),
        props.onPairedNodesRefresh,
      )}
      ${renderConnectedInstances({
        entries: props.connectedInstances,
        loading: Boolean(props.connectedInstancesLoading),
        error: props.connectedInstancesError ?? null,
        statusMessage: props.connectedInstancesStatus ?? null,
        onRefresh: props.onConnectedInstancesRefresh,
      })}
    </section>
  `;
}

/**
 * astroclaw/0020: paired astroclaw nodes card. Lives inside the Siblings
 * panel below the mesh grid so the operator sees mesh siblings and
 * paired peers on the same page.
 */
function renderPairedNodes(
  nodes: Array<Record<string, unknown>> | undefined,
  loading: boolean,
  onRefresh: (() => void) | undefined,
): TemplateResult {
  if (!nodes) {
    return html``;
  }
  return html`
    <div class="card" style="padding: 12px; margin-top: 16px;">
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="card-title" style="font-size: 0.9em;">Paired nodes (${nodes.length})</div>
          <div class="card-sub">astroclaw peer nodes paired with this gateway.</div>
        </div>
        ${onRefresh
          ? html`
              <button class="btn btn--sm" ?disabled=${loading} @click=${onRefresh}>
                ${loading ? t("common.loading") : t("common.refresh")}
              </button>
            `
          : nothing}
      </div>
      ${nodes.length === 0
        ? html`<div class="muted" style="margin-top: 8px;">No paired nodes.</div>`
        : html`
            <ul style="margin: 8px 0 0 0; padding-left: 0; list-style: none;">
              ${nodes.map((n) => renderPairedNodeRow(n))}
            </ul>
          `}
    </div>
  `;
}

function renderPairedNodeRow(node: Record<string, unknown>): TemplateResult {
  const connected = Boolean(node.connected);
  const paired = Boolean(node.paired);
  const title =
    (typeof node.displayName === "string" && node.displayName.trim()) ||
    (typeof node.nodeId === "string" ? node.nodeId : "unknown");
  const detailParts = [
    typeof node.nodeId === "string" ? node.nodeId : "",
    typeof node.remoteIp === "string" ? node.remoteIp : "",
    typeof node.version === "string" ? node.version : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return html`
    <li style="padding: 6px 0; border-bottom: 1px solid var(--surface-2, #f4f4f5);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div><strong>${title}</strong></div>
          ${detailParts
            ? html`<div class="muted" style="font-size: 0.85em;">${detailParts}</div>`
            : nothing}
        </div>
        <div style="display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end;">
          <span class="badge" style="font-size: 0.7em;">${paired ? "paired" : "unpaired"}</span>
          <span
            class="badge"
            style="font-size: 0.7em; background: ${connected
              ? "#86efac"
              : "#fde68a"}; color: #052e16;"
          >
            ${connected ? "connected" : "offline"}
          </span>
        </div>
      </div>
    </li>
  `;
}

/**
 * astroclaw/0027: connected instances card. Lives inside the Siblings
 * panel below the paired-nodes card so the operator sees mesh
 * siblings, paired peers, and active client sessions on the same
 * page. Hosts/IPs stay masked by default — same control as the
 * standalone Instances page.
 */
let connectedInstancesHostsRevealed = false;

function renderConnectedInstances(args: {
  entries: PresenceEntry[] | undefined;
  loading: boolean;
  error: string | null;
  statusMessage: string | null;
  onRefresh: (() => void) | undefined;
}): TemplateResult | typeof nothing {
  if (!args.entries || !args.onRefresh) {
    return nothing;
  }
  const entries = args.entries;
  const masked = !connectedInstancesHostsRevealed;
  return html`
    <section class="card" style="margin-top: 16px;">
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="card-title">${t("instances.title")} (${entries.length})</div>
          <div class="card-sub">${t("instances.subtitle")}</div>
        </div>
        <div class="row" style="gap: 8px;">
          <button
            class="btn btn--icon ${masked ? "" : "active"}"
            @click=${() => {
              connectedInstancesHostsRevealed = !connectedInstancesHostsRevealed;
              args.onRefresh?.();
            }}
            title=${masked ? t("instances.showHosts") : t("instances.hideHosts")}
            aria-label=${t("instances.toggleHostVisibility")}
            aria-pressed=${!masked}
            style="width: 32px; height: 32px;"
          >
            ${masked ? "👁︎" : "👁"}
          </button>
          <button class="btn" ?disabled=${args.loading} @click=${args.onRefresh}>
            ${args.loading ? t("common.loading") : t("common.refresh")}
          </button>
        </div>
      </div>
      ${args.error
        ? html`<div class="callout danger" style="margin-top: 12px;">${args.error}</div>`
        : nothing}
      ${args.statusMessage
        ? html`<div class="callout" style="margin-top: 12px;">${args.statusMessage}</div>`
        : nothing}
      <div class="list" style="margin-top: 12px;">
        ${entries.length === 0
          ? html`<div class="muted">${t("instances.noInstances")}</div>`
          : entries.map((entry) => renderConnectedInstanceRow(entry, masked))}
      </div>
    </section>
  `;
}

function renderConnectedInstanceRow(entry: PresenceEntry, masked: boolean): TemplateResult {
  const lastInput =
    entry.lastInputSeconds != null
      ? t("common.secondsAgo", { count: String(entry.lastInputSeconds) })
      : t("common.na");
  const mode = entry.mode ?? "unknown";
  const host = entry.host ?? "unknown host";
  const ip = entry.ip ?? null;
  const roles = Array.isArray(entry.roles) ? entry.roles.filter(Boolean) : [];
  const scopes = Array.isArray(entry.scopes) ? entry.scopes.filter(Boolean) : [];
  const scopesLabel =
    scopes.length > 0
      ? scopes.length > 3
        ? `${scopes.length} scopes`
        : `scopes: ${scopes.join(", ")}`
      : null;
  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">
          <span class="${masked ? "redacted" : ""}">${host}</span>
        </div>
        <div class="list-sub">
          ${ip ? html`<span class="${masked ? "redacted" : ""}">${ip}</span> ` : nothing}${mode}
          ${entry.version ?? ""}
        </div>
        <div class="chip-row">
          <span class="chip">${mode}</span>
          ${roles.map((role) => html`<span class="chip">${role}</span>`)}
          ${scopesLabel ? html`<span class="chip">${scopesLabel}</span>` : nothing}
          ${entry.platform ? html`<span class="chip">${entry.platform}</span>` : nothing}
          ${entry.deviceFamily ? html`<span class="chip">${entry.deviceFamily}</span>` : nothing}
          ${entry.modelIdentifier
            ? html`<span class="chip">${entry.modelIdentifier}</span>`
            : nothing}
          ${entry.version ? html`<span class="chip">${entry.version}</span>` : nothing}
        </div>
      </div>
      <div class="list-meta">
        <div>${formatPresenceAge(entry)}</div>
        <div class="muted">${t("instances.lastInput", { time: lastInput })}</div>
        <div class="muted">${t("instances.reason", { reason: entry.reason ?? "" })}</div>
      </div>
    </div>
  `;
}

function renderThisNode(node: ProliferationSiblingNode): TemplateResult {
  return html`
    <div class="card" style="padding: 12px;">
      <div class="card-title" style="font-size: 0.9em;">This node</div>
      <dl style="margin: 8px 0;">
        <dt style="opacity: 0.7; font-size: 0.85em;">ID</dt>
        <dd style="margin: 0 0 6px 0;"><code>${node.id}</code></dd>
        <dt style="opacity: 0.7; font-size: 0.85em;">Substrate</dt>
        <dd style="margin: 0 0 6px 0;">${node.substrate}</dd>
        <dt style="opacity: 0.7; font-size: 0.85em;">Trust zone</dt>
        <dd style="margin: 0 0 6px 0;">
          ${node.trust_zone}
          ${node.is_identity_anchor ? html`<span class="badge">identity-anchor</span>` : nothing}
        </dd>
        ${typeof node.uptime_ms === "number"
          ? html`
              <dt style="opacity: 0.7; font-size: 0.85em;">Uptime</dt>
              <dd style="margin: 0;">${formatDurationMs(node.uptime_ms)}</dd>
            `
          : nothing}
      </dl>
    </div>
  `;
}

function renderMesh(
  mesh: { member_count: number; members: string[] },
  selfId?: string,
): TemplateResult {
  return html`
    <div class="card" style="padding: 12px;">
      <div class="card-title" style="font-size: 0.9em;">
        Mesh (${mesh.member_count} ${mesh.member_count === 1 ? "node" : "nodes"})
      </div>
      ${mesh.members.length === 0
        ? html`<div class="muted">No siblings advertised.</div>`
        : html`
            <ul style="margin: 8px 0 0 0; padding-left: 20px;">
              ${mesh.members.map(
                (id) => html`
                  <li>
                    <code>${id}</code>${id === selfId
                      ? html` <span class="muted">(self)</span>`
                      : nothing}
                  </li>
                `,
              )}
            </ul>
          `}
    </div>
  `;
}

function renderLeases(leases: string[]): TemplateResult {
  return html`
    <div class="card" style="padding: 12px;">
      <div class="card-title" style="font-size: 0.9em;">Leases held (${leases.length})</div>
      ${leases.length === 0
        ? html`<div class="muted">None.</div>`
        : html`
            <ul style="margin: 8px 0 0 0; padding-left: 20px;">
              ${leases.map((key) => html`<li><code>${key}</code></li>`)}
            </ul>
          `}
    </div>
  `;
}

function renderHeartbeat(
  heartbeat: { last_tick_at_ms: number; tick_seq: number; gap_ms: number } | undefined,
): TemplateResult {
  if (!heartbeat) {
    return html`
      <div class="card" style="padding: 12px;">
        <div class="card-title" style="font-size: 0.9em;">Heartbeat</div>
        <div class="muted">No heartbeat reported.</div>
      </div>
    `;
  }
  const gapColor =
    heartbeat.gap_ms > 5000 ? "#dc2626" : heartbeat.gap_ms > 2000 ? "#f59e0b" : "#10b981";
  return html`
    <div class="card" style="padding: 12px;">
      <div class="card-title" style="font-size: 0.9em;">Heartbeat</div>
      <dl style="margin: 8px 0;">
        <dt style="opacity: 0.7; font-size: 0.85em;">Last tick</dt>
        <dd style="margin: 0 0 6px 0;">
          ${formatRelativeTimestamp(heartbeat.last_tick_at_ms)}
          <span style="color: ${gapColor};">(gap ${formatDurationMs(heartbeat.gap_ms)})</span>
        </dd>
        <dt style="opacity: 0.7; font-size: 0.85em;">Tick seq</dt>
        <dd style="margin: 0;"><code>${heartbeat.tick_seq}</code></dd>
      </dl>
    </div>
  `;
}

function renderReplication(
  postgres: { connected: boolean; configured: boolean } | undefined,
  replication: { peers: number; lag_ms: number } | undefined,
): TemplateResult {
  return html`
    <div class="card" style="padding: 12px;">
      <div class="card-title" style="font-size: 0.9em;">Replication</div>
      <dl style="margin: 8px 0;">
        <dt style="opacity: 0.7; font-size: 0.85em;">Postgres</dt>
        <dd style="margin: 0 0 6px 0;">
          ${postgres?.connected
            ? html`<span style="color: #10b981;">connected</span>`
            : postgres?.configured
              ? html`<span style="color: #f59e0b;">configured but not connected</span>`
              : html`<span class="muted">not configured (phase-1)</span>`}
        </dd>
        ${replication
          ? html`
              <dt style="opacity: 0.7; font-size: 0.85em;">Peers</dt>
              <dd style="margin: 0 0 6px 0;">${replication.peers}</dd>
              <dt style="opacity: 0.7; font-size: 0.85em;">Lag</dt>
              <dd style="margin: 0;">${formatDurationMs(replication.lag_ms)}</dd>
            `
          : nothing}
      </dl>
    </div>
  `;
}

function renderEvents(
  events: Record<string, number>,
  channelSendsAllowed: number | undefined,
): TemplateResult {
  const entries = Object.entries(events).filter(([, count]) => count > 0);
  return html`
    <div class="card" style="padding: 12px; grid-column: span 2;">
      <div class="card-title" style="font-size: 0.9em;">Observed activity</div>
      ${entries.length === 0 && channelSendsAllowed === undefined
        ? html`<div class="muted">No events recorded yet.</div>`
        : html`
            <table style="width: 100%; margin-top: 8px; border-collapse: collapse;">
              ${entries.map(
                ([name, count]) => html`
                  <tr>
                    <td style="padding: 4px 0; opacity: 0.7;"><code>${name}</code></td>
                    <td style="padding: 4px 0; text-align: right;">${count}</td>
                  </tr>
                `,
              )}
              ${typeof channelSendsAllowed === "number"
                ? html`
                    <tr>
                      <td style="padding: 4px 0; opacity: 0.7;">channel sends allowed</td>
                      <td style="padding: 4px 0; text-align: right;">${channelSendsAllowed}</td>
                    </tr>
                  `
                : nothing}
            </table>
          `}
    </div>
  `;
}

function renderReplicationActivity(args: {
  workspaceReplications: number | undefined;
  sessionSnapshots: number | undefined;
  snapshotBodiesPushed: number | undefined;
}): TemplateResult {
  const rows: Array<[string, number]> = [];
  if (typeof args.workspaceReplications === "number") {
    rows.push(["workspace writes replicated", args.workspaceReplications]);
  }
  if (typeof args.sessionSnapshots === "number") {
    rows.push(["session snapshots observed", args.sessionSnapshots]);
  }
  if (typeof args.snapshotBodiesPushed === "number") {
    rows.push(["snapshot bodies pushed (CAS)", args.snapshotBodiesPushed]);
  }
  if (rows.length === 0) {
    return html``;
  }
  return html`
    <div class="card" style="padding: 12px; grid-column: span 2;">
      <div class="card-title" style="font-size: 0.9em;">Replication activity (phase-3)</div>
      <table style="width: 100%; margin-top: 8px; border-collapse: collapse;">
        ${rows.map(
          ([name, count]) => html`
            <tr>
              <td style="padding: 4px 0; opacity: 0.7;">${name}</td>
              <td style="padding: 4px 0; text-align: right;">${count}</td>
            </tr>
          `,
        )}
      </table>
    </div>
  `;
}

function renderEidetic(
  eidetic: NonNullable<ProliferationHealth["eidetic"]> | undefined,
): TemplateResult {
  if (!eidetic) {
    return html``;
  }
  const isReplica = eidetic.role === "replica";
  const roleBg = eidetic.role === "primary" ? "#86efac" : isReplica ? "#bae6fd" : "#fde68a";
  const lagColor =
    typeof eidetic.lag_ms === "number"
      ? eidetic.lag_ms > 60_000
        ? "#dc2626"
        : eidetic.lag_ms > 10_000
          ? "#f59e0b"
          : "#10b981"
      : undefined;
  return html`
    <div class="card" style="padding: 12px; grid-column: span 2;">
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div class="card-title" style="font-size: 0.9em;">
          Eidetic
          <span
            class="badge"
            style="margin-left: 8px; padding: 2px 8px; border-radius: 999px;
                   background: ${roleBg}; color: #052e16; font-size: 0.75em;"
            >${eidetic.role}</span
          >
        </div>
      </div>
      <dl
        style="margin: 8px 0; display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px;"
      >
        ${eidetic.endpoint
          ? html`
              <dt style="opacity: 0.7; font-size: 0.85em;">Endpoint</dt>
              <dd style="margin: 0;"><code>${eidetic.endpoint}</code></dd>
            `
          : nothing}
        ${typeof eidetic.lag_ms === "number"
          ? html`
              <dt style="opacity: 0.7; font-size: 0.85em;">Replica lag</dt>
              <dd style="margin: 0; color: ${lagColor};">${formatDurationMs(eidetic.lag_ms)}</dd>
            `
          : nothing}
        ${typeof eidetic.last_pull_at_ms === "number"
          ? html`
              <dt style="opacity: 0.7; font-size: 0.85em;">Last pull</dt>
              <dd style="margin: 0;">${formatRelativeTimestamp(eidetic.last_pull_at_ms)}</dd>
            `
          : nothing}
        ${eidetic.snapshots
          ? html`
              <dt style="opacity: 0.7; font-size: 0.85em;">Snapshots</dt>
              <dd style="margin: 0;">
                ${eidetic.snapshots.count}
                ${typeof eidetic.snapshots.last_at_ms === "number"
                  ? html` <span class="muted"
                      >· last ${formatRelativeTimestamp(eidetic.snapshots.last_at_ms)}</span
                    >`
                  : nothing}
                ${typeof eidetic.snapshots.last_bytes === "number"
                  ? html` <span class="muted">· ${formatBytes(eidetic.snapshots.last_bytes)}</span>`
                  : nothing}
              </dd>
            `
          : nothing}
        ${eidetic.pgvector
          ? html`
              <dt style="opacity: 0.7; font-size: 0.85em;">pgvector</dt>
              <dd style="margin: 0;">
                ${eidetic.pgvector.embeddings}
                embeddings${typeof eidetic.pgvector.dimensions === "number"
                  ? html` <span class="muted">· dim ${eidetic.pgvector.dimensions}</span>`
                  : nothing}
              </dd>
            `
          : nothing}
        ${eidetic.dispatch_queue
          ? html`
              <dt style="opacity: 0.7; font-size: 0.85em;">DISPATCH queue</dt>
              <dd style="margin: 0;">
                ${eidetic.dispatch_queue.pending} pending
                <span class="muted">· ${eidetic.dispatch_queue.in_flight} in-flight</span>
              </dd>
            `
          : nothing}
      </dl>
    </div>
  `;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KiB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MiB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GiB`;
}

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m${Math.floor((ms % 60_000) / 1000)}s`;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h${m}m`;
}
