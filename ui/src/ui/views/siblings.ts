import { html, nothing, type TemplateResult } from "lit";
import { t } from "../../i18n/index.ts";
import { formatRelativeTimestamp } from "../format.ts";

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
};

export type SiblingsProps = {
  loading: boolean;
  error?: string | null;
  proliferation?: ProliferationHealth | null;
  onRefresh: () => void;
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
      </div>
    </section>
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

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m${Math.floor((ms % 60_000) / 1000)}s`;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h${m}m`;
}
