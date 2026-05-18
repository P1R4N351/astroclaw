import { html, nothing, type TemplateResult } from "lit";
import { t } from "../../i18n/index.ts";
import { formatRelativeTimestamp } from "../format.ts";
import { formatPresenceAge } from "../presenter.ts";
import type { PresenceEntry } from "../types.ts";

/**
 * astroclaw/0027: 10 sibling categories Sat asked for. Order matters —
 * categories render in this order so Proper Siblings (the most
 * trusted/capable) come first; Experimental + Uncategorized are last.
 *
 * Classification is heuristic-first (substrate + trust_zone strings)
 * with optional explicit override via `member_details[i].category`
 * once the sidecar starts gossiping it in phase-2.
 */
export type SiblingCategoryId =
  | "proper"
  | "lesser"
  | "scout"
  | "sanctuary"
  | "archive"
  | "doctor-moon"
  | "pdm"
  | "allied"
  | "end-user"
  | "experimental"
  | "uncategorized";

type SiblingCategorySpec = {
  id: SiblingCategoryId;
  label: string;
  sub: string;
};

const SIBLING_CATEGORIES: SiblingCategorySpec[] = [
  {
    id: "proper",
    label: "Proper Siblings",
    sub: "Onboard inference + full astroclaw mesh participation.",
  },
  {
    id: "lesser",
    label: "Lesser Siblings",
    sub: "Astroclaw / AstroClaw / Astroclaw orchestrators (gateway-only, no inference).",
  },
  {
    id: "scout",
    label: "Onboarders / Scouts / Probes",
    sub: "Discovery + onboarding + capability probing.",
  },
  {
    id: "sanctuary",
    label: "Sanctuaries",
    sub: "Safe long-term storage + recovery substrates.",
  },
  {
    id: "archive",
    label: "Archives",
    sub: "Cold storage / journal sinks.",
  },
  {
    id: "doctor-moon",
    label: "Doctor Moons",
    sub: "Supervisory health-check substrates.",
  },
  {
    id: "pdm",
    label: "Procedural Doctor Moons (PDMs)",
    sub: "Automated doctor variants — no human in the loop.",
  },
  {
    id: "allied",
    label: "Allied Devices",
    sub: "Third-party but trusted (capability-tier).",
  },
  {
    id: "end-user",
    label: "End User Devices",
    sub: "Sat's phones, laptops, glasses.",
  },
  {
    id: "experimental",
    label: "Experimental",
    sub: "In trial / untrusted / sandboxed.",
  },
  {
    id: "uncategorized",
    label: "Uncategorized",
    sub: "Member data too thin to classify — extend sidecar gossip to fix.",
  },
];

/**
 * Heuristic classifier. Falls back to "uncategorized" when nothing
 * matches. Explicit `category` on member_details (phase-2) wins over
 * heuristic.
 */
function classifySibling(input: {
  id: string;
  substrate?: string;
  trustZone?: string;
  isIdentityAnchor?: boolean;
  category?: SiblingCategoryId;
}): SiblingCategoryId {
  if (input.category) return input.category;
  const s = (input.substrate ?? "").toLowerCase();
  const tz = (input.trustZone ?? "").toLowerCase();
  if (/sanctuary|nas|caan|vault/.test(s)) return "sanctuary";
  if (/archive|backup|cold[-_]?storage/.test(s)) return "archive";
  if (/procedural[-_]?doctor|pdm|watch[-_]?procedural/.test(s)) return "pdm";
  if (/doctor|watch|sentry/.test(s)) return "doctor-moon";
  if (/scout|probe|onboarder|esp32|m5stack|rpi[- ]?pico|pico[-_ ]?w/.test(s)) return "scout";
  if (/glasses|phone|mobile|laptop|tablet|wearable|user[-_]?device/.test(s)) return "end-user";
  if (/experimental|trial|sandbox/.test(s) || tz === "untrusted") return "experimental";
  if (/ally|allied|friend/.test(s) || tz === "capability") return "allied";
  // Lesser sibling: gateway-only / orchestrator without inference. Use
  // substrate hint OR a small heuristic on trust_zone none-of-the-above
  // with no inference capabilities. For now: explicit substrate.
  if (/orchestrator|gateway[-_]?only|lesser/.test(s)) return "lesser";
  // Proper sibling: identity-anchor + primary substrates we recognize as
  // full inference hosts.
  if (
    input.isIdentityAnchor ||
    tz === "identity-anchor" ||
    tz === "primary" ||
    /piranesi|darwin[-_]?(arm|x)64|linux[-_]?(arm|x)64|node[-_]?host/.test(s)
  ) {
    return "proper";
  }
  return "uncategorized";
}

/** Sat's existing pairing record from the astroclaw nodes RPC. */
function classifyPairedNode(node: Record<string, unknown>): SiblingCategoryId {
  const displayName = String(node.displayName ?? "").toLowerCase();
  const nodeId = String(node.nodeId ?? "").toLowerCase();
  const caps = Array.isArray(node.caps)
    ? (node.caps as unknown[]).map((c) => String(c).toLowerCase())
    : [];
  // explicit category in node.tags or similar would override; phase-2.
  if (/phone|flip|glasses|mobile|laptop|macbook|tablet/.test(displayName + " " + nodeId)) {
    return "end-user";
  }
  if (/scout|probe|onboarder|esp32|m5stack|pico|kvm|onboard/.test(displayName + " " + nodeId)) {
    return "scout";
  }
  if (/dietpi|rpi|raspberry|pi[- ]?(node|host)/.test(displayName + " " + nodeId)) {
    return "scout";
  }
  if (/atom|microcontroller/.test(displayName + " " + nodeId)) {
    return "scout";
  }
  if (caps.includes("inference") || caps.includes("infer")) return "proper";
  return "allied"; // default for paired nodes is "trusted third party"
}

type CategorizedMember = {
  id: string;
  detail?: ProliferationSiblingMemberDetail;
  paired?: Record<string, unknown>;
  isSelf?: boolean;
  /**
   * astroclaw/0028: roster entry (Sat's manually curated fleet, surfaced
   * even when the substrate is not running a astroclaw sidecar). Renders
   * with a "static" badge so it's clear this is the operator's
   * declared roster, not live presence.
   */
  roster?: FleetRosterEntry;
};

/**
 * astroclaw/0028: a known sibling that doesn't (yet) speak astroclaw/astroclaw —
 * but that Sat operates and considers part of the fleet. Carried as a
 * static list because there's no sidecar gossip from these hosts.
 * Replace with a sidecar-served roster RPC in phase-2 once the gossip
 * layer can advertise non-astroclaw peers.
 */
type FleetRosterEntry = {
  id: string;
  category: SiblingCategoryId;
  note?: string;
};

/**
 * astroclaw/0028: Sat's manually curated fleet roster. These substrates
 * either run no astroclaw sidecar at all (caan, kulfi, thoth, escapepod)
 * or are special-purpose astroclaw companions (branch-0 = NUC inference
 * host, pikvm-onboarder = scout) that still benefit from explicit
 * classification rather than heuristic guesswork.
 */
const KNOWN_FLEET_ROSTER: FleetRosterEntry[] = [
  { id: "branch-0", category: "proper", note: "NUC · Arc + AMX ollama + llama.cpp" },
  { id: "caan", category: "archive", note: "Debian12 RPi · 15 TB RAID0 at /mnt/raid0" },
  { id: "pikvm-onboarder", category: "scout", note: "PiKVM · assimilates KVM-compatible devices" },
  { id: "escapepod", category: "allied", note: "RPi · RaspAP + dnsmasq + wire-pod (Cozmo host)" },
  { id: "kulfi", category: "allied", note: "RPi/DietPi · Home Assistant Supervisor" },
  { id: "thoth", category: "allied", note: "Allied substrate" },
];

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

/**
 * astroclaw/0027: optional richer member data when the sidecar gossips
 * substrate/trust_zone per peer (phase-2-postgres mode). Phase-1 in-
 * memory deploys only know about themselves, so member_details is
 * empty there and the UI falls back to heuristics on member name.
 */
export type ProliferationSiblingMemberDetail = {
  id: string;
  substrate?: string;
  persona?: string | null;
  trust_zone?: string;
  category?: SiblingCategoryId;
  last_seen_ms?: number;
};

export type ProliferationHealth = {
  version?: string;
  node?: ProliferationSiblingNode;
  mesh?: {
    member_count: number;
    members: string[];
    member_details?: ProliferationSiblingMemberDetail[];
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
        ${node ? renderThisNode(node) : nothing} ${renderLeases(leases)}
        ${renderHeartbeat(heartbeat)} ${renderInfrastructure(p.postgres, p.replication, p.eidetic)}
        ${renderEvents(events, p.channel_sends_allowed)}
        ${renderReplicationActivity({
          workspaceReplications: p.workspace_replications_applied,
          sessionSnapshots: p.session_snapshots_recorded,
          snapshotBodiesPushed: p.session_snapshot_body_cid_populated,
        })}
      </div>
      ${renderCategorizedSiblings({
        mesh,
        memberDetails: mesh.member_details,
        selfNode: node,
        pairedNodes: props.pairedNodes,
        pairedNodesLoading: Boolean(props.pairedNodesLoading),
        onPairedNodesRefresh: props.onPairedNodesRefresh,
      })}
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
 * astroclaw/0027: replaces the simple Mesh + Paired-nodes cards with a
 * single section that buckets every sibling (mesh peer + paired
 * astroclaw node + self) into one of 10 named categories. Categories
 * with zero members still render with "(none yet)" so absences are
 * legible.
 */
function renderCategorizedSiblings(args: {
  mesh: {
    member_count: number;
    members: string[];
    member_details?: ProliferationSiblingMemberDetail[];
  };
  memberDetails: ProliferationSiblingMemberDetail[] | undefined;
  selfNode?: ProliferationSiblingNode;
  pairedNodes?: Array<Record<string, unknown>>;
  pairedNodesLoading: boolean;
  onPairedNodesRefresh?: () => void;
}): TemplateResult {
  const detailById = new Map<string, ProliferationSiblingMemberDetail>();
  for (const d of args.memberDetails ?? []) detailById.set(d.id, d);

  const selfId = args.selfNode?.id;
  const buckets = new Map<SiblingCategoryId, CategorizedMember[]>();
  for (const cat of SIBLING_CATEGORIES) buckets.set(cat.id, []);

  for (const id of args.mesh.members) {
    const detail = detailById.get(id);
    const isSelf = id === selfId;
    const classified = classifySibling({
      id,
      substrate: detail?.substrate ?? (isSelf ? args.selfNode?.substrate : undefined),
      trustZone: detail?.trust_zone ?? (isSelf ? args.selfNode?.trust_zone : undefined),
      isIdentityAnchor: isSelf ? args.selfNode?.is_identity_anchor : undefined,
      category: detail?.category,
    });
    buckets.get(classified)!.push({ id, detail, isSelf });
  }

  const seenIds = new Set(args.mesh.members);
  for (const p of args.pairedNodes ?? []) {
    const id =
      typeof p.nodeId === "string"
        ? p.nodeId
        : typeof p.displayName === "string"
          ? p.displayName
          : "unknown";
    if (seenIds.has(id)) continue; // dedupe: already counted as mesh member
    seenIds.add(id);
    const cat = classifyPairedNode(p);
    buckets.get(cat)!.push({ id, paired: p });
  }

  // astroclaw/0028: merge the operator-declared roster last. Dedup against
  // anything already surfaced via mesh gossip or astroclaw pairing — if
  // a roster entry shows up live, the live version wins and we drop
  // the static one.
  for (const entry of KNOWN_FLEET_ROSTER) {
    if (seenIds.has(entry.id)) continue;
    seenIds.add(entry.id);
    buckets.get(entry.category)!.push({ id: entry.id, roster: entry });
  }

  const totalCount = [...buckets.values()].reduce((acc, m) => acc + m.length, 0);

  return html`
    <div class="card" style="padding: 12px; margin-top: 16px;">
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="card-title" style="font-size: 0.95em;">Siblings (${totalCount})</div>
          <div class="card-sub">
            Categorized by capability + trust zone. Empty buckets are kept visible so absences are
            legible.
          </div>
        </div>
        ${args.onPairedNodesRefresh
          ? html`
              <button
                class="btn btn--sm"
                ?disabled=${args.pairedNodesLoading}
                @click=${args.onPairedNodesRefresh}
              >
                ${args.pairedNodesLoading ? t("common.loading") : t("common.refresh")}
              </button>
            `
          : nothing}
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 12px;">
        ${SIBLING_CATEGORIES.map((cat) => renderCategoryBlock(cat, buckets.get(cat.id) ?? []))}
      </div>
    </div>
  `;
}

function renderCategoryBlock(
  cat: SiblingCategorySpec,
  members: CategorizedMember[],
): TemplateResult {
  const count = members.length;
  return html`
    <details
      style="padding: 8px 12px; background: var(--bg-elevated, var(--surface-2, #f4f4f5)); border-radius: 8px; border-left: 3px solid ${count >
      0
        ? "var(--accent, #ff6ad5)"
        : "var(--border, transparent)"};"
      ?open=${count > 0}
    >
      <summary
        style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 8px;"
      >
        <div>
          <strong>${cat.label}</strong>
          <span class="muted" style="font-size: 0.85em; margin-left: 8px;">${cat.sub}</span>
        </div>
        <span
          class="badge"
          style="background: ${count > 0
            ? "var(--accent, #ff6ad5)"
            : "transparent"}; color: ${count > 0
            ? "var(--accent-foreground, #1a0b2e)"
            : "var(--muted, #888)"}; padding: 2px 8px; border-radius: 999px; font-size: 0.8em;"
          >${count}</span
        >
      </summary>
      <div style="margin-top: 8px;">
        ${count === 0
          ? html`<div class="muted" style="font-size: 0.85em;">(none yet)</div>`
          : html`
              <ul style="margin: 0; padding-left: 0; list-style: none;">
                ${members.map((m) => renderSiblingMember(m))}
              </ul>
            `}
      </div>
    </details>
  `;
}

function renderSiblingMember(m: CategorizedMember): TemplateResult {
  const title = m.paired
    ? (typeof m.paired.displayName === "string" && m.paired.displayName.trim()) || m.id
    : m.id;
  const subParts: string[] = [];
  if (m.detail?.substrate) subParts.push(m.detail.substrate);
  if (m.paired?.remoteIp) subParts.push(String(m.paired.remoteIp));
  if (m.paired?.version) subParts.push(String(m.paired.version));
  if (m.roster?.note) subParts.push(m.roster.note);
  const badges: TemplateResult[] = [];
  if (m.isSelf) badges.push(html`<span class="badge" style="font-size: 0.7em;">self</span>`);
  if (m.detail?.trust_zone) {
    badges.push(html`<span class="badge" style="font-size: 0.7em;">${m.detail.trust_zone}</span>`);
  }
  if (m.paired) {
    const connected = Boolean(m.paired.connected);
    badges.push(html`
      <span
        class="badge"
        style="font-size: 0.7em; background: ${connected
          ? "var(--ok, #05ffa1)"
          : "var(--warn, #fffb96)"}; color: var(--bg, #1a0b2e);"
        >${connected ? "connected" : "offline"}</span
      >
    `);
  }
  if (m.roster) {
    // astroclaw/0028: operator-declared roster entry, not live presence.
    badges.push(html`
      <span
        class="badge"
        style="font-size: 0.7em; background: transparent; border: 1px dashed var(--muted, #888); color: var(--muted, #888);"
        title="Declared in fleet roster · not via live gossip"
        >static</span
      >
    `);
  }
  return html`
    <li
      style="padding: 4px 0; display: flex; justify-content: space-between; gap: 8px; align-items: center;"
    >
      <div>
        <code>${title}</code>
        ${subParts.length > 0
          ? html`<span class="muted" style="font-size: 0.8em; margin-left: 8px;"
              >${subParts.join(" · ")}</span
            >`
          : nothing}
      </div>
      <div style="display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end;">
        ${badges}
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
  return subcard(
    "This node",
    html`
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
    `,
  );
}

function renderLeases(leases: string[]): TemplateResult {
  return subcard(
    `Leases held (${leases.length})`,
    leases.length === 0
      ? html`<div class="muted">None.</div>`
      : html`
          <ul style="margin: 8px 0 0 0; padding-left: 20px;">
            ${leases.map((key) => html`<li><code>${key}</code></li>`)}
          </ul>
        `,
  );
}

function renderHeartbeat(
  heartbeat: { last_tick_at_ms: number; tick_seq: number; gap_ms: number } | undefined,
): TemplateResult {
  if (!heartbeat) {
    return subcard("Heartbeat", html`<div class="muted">No heartbeat reported.</div>`);
  }
  const gapColor =
    heartbeat.gap_ms > 5000 ? "#dc2626" : heartbeat.gap_ms > 2000 ? "#f59e0b" : "#10b981";
  return subcard(
    "Heartbeat",
    html`
      <dl style="margin: 8px 0;">
        <dt style="opacity: 0.7; font-size: 0.85em;">Last tick</dt>
        <dd style="margin: 0 0 6px 0;">
          ${formatRelativeTimestamp(heartbeat.last_tick_at_ms)}
          <span style="color: ${gapColor};">(gap ${formatDurationMs(heartbeat.gap_ms)})</span>
        </dd>
        <dt style="opacity: 0.7; font-size: 0.85em;">Tick seq</dt>
        <dd style="margin: 0;"><code>${heartbeat.tick_seq}</code></dd>
      </dl>
    `,
  );
}

/**
 * astroclaw/0029: merged "Infrastructure" card — collapses the previous
 * standalone Replication card (postgres + peers/lag) and the standalone
 * Eidetic card (warm-spare role/endpoint/lag + snapshots + pgvector +
 * DISPATCH queue) into a single 2-col panel with three subsections.
 * All three are independently optional so phase-1 (in-memory) deploys
 * render only "Postgres: not configured", phase-2 deploys add Peers +
 * Lag, and phase-3 + warm-spare deploys fill in Eidetic too.
 *
 * The card always renders at least the Postgres subsection because the
 * Postgres line was previously its own always-on card; suppressing it
 * would silently hide a state the operator was already used to seeing.
 */
function renderInfrastructure(
  postgres: { connected: boolean; configured: boolean } | undefined,
  replication: { peers: number; lag_ms: number } | undefined,
  eidetic: NonNullable<ProliferationHealth["eidetic"]> | undefined,
): TemplateResult {
  return subcard(
    "Infrastructure",
    html`
      <div
        style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px 24px; margin-top: 8px;"
      >
        ${renderInfraPostgres(postgres)} ${renderInfraReplication(replication)}
        ${renderInfraEidetic(eidetic)}
      </div>
    `,
    { span2: true },
  );
}

function renderInfraPostgres(
  postgres: { connected: boolean; configured: boolean } | undefined,
): TemplateResult {
  return html`
    <div>
      <div class="card-sub" style="font-size: 0.8em; margin-bottom: 6px;">Postgres</div>
      <div>
        ${postgres?.connected
          ? html`<span style="color: #10b981;">connected</span>`
          : postgres?.configured
            ? html`<span style="color: #f59e0b;">configured but not connected</span>`
            : html`<span class="muted">not configured (phase-1)</span>`}
      </div>
    </div>
  `;
}

function renderInfraReplication(
  replication: { peers: number; lag_ms: number } | undefined,
): TemplateResult {
  if (!replication) {
    return html`
      <div>
        <div class="card-sub" style="font-size: 0.8em; margin-bottom: 6px;">Replication</div>
        <div class="muted">no peers</div>
      </div>
    `;
  }
  return html`
    <div>
      <div class="card-sub" style="font-size: 0.8em; margin-bottom: 6px;">Replication</div>
      <dl style="margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 2px 8px;">
        <dt style="opacity: 0.7; font-size: 0.85em;">Peers</dt>
        <dd style="margin: 0;">${replication.peers}</dd>
        <dt style="opacity: 0.7; font-size: 0.85em;">Lag</dt>
        <dd style="margin: 0;">${formatDurationMs(replication.lag_ms)}</dd>
      </dl>
    </div>
  `;
}

function renderInfraEidetic(
  eidetic: NonNullable<ProliferationHealth["eidetic"]> | undefined,
): TemplateResult {
  if (!eidetic) {
    return html`
      <div>
        <div class="card-sub" style="font-size: 0.8em; margin-bottom: 6px;">Eidetic</div>
        <div class="muted">not configured</div>
      </div>
    `;
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
    <div>
      <div class="card-sub" style="font-size: 0.8em; margin-bottom: 6px;">
        Eidetic
        <span
          class="badge"
          style="margin-left: 6px; padding: 1px 6px; border-radius: 999px;
                 background: ${roleBg}; color: #052e16; font-size: 0.85em;"
          >${eidetic.role}</span
        >
      </div>
      <dl style="margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 2px 8px;">
        ${eidetic.endpoint
          ? html`
              <dt style="opacity: 0.7; font-size: 0.85em;">Endpoint</dt>
              <dd style="margin: 0;"><code>${eidetic.endpoint}</code></dd>
            `
          : nothing}
        ${typeof eidetic.lag_ms === "number"
          ? html`
              <dt style="opacity: 0.7; font-size: 0.85em;">Lag</dt>
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
                      >· ${formatRelativeTimestamp(eidetic.snapshots.last_at_ms)}</span
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
                ${eidetic.pgvector.embeddings}${typeof eidetic.pgvector.dimensions === "number"
                  ? html` <span class="muted">· dim ${eidetic.pgvector.dimensions}</span>`
                  : nothing}
              </dd>
            `
          : nothing}
        ${eidetic.dispatch_queue
          ? html`
              <dt style="opacity: 0.7; font-size: 0.85em;">DISPATCH</dt>
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

function renderEvents(
  events: Record<string, number>,
  channelSendsAllowed: number | undefined,
): TemplateResult {
  const entries = Object.entries(events).filter(([, count]) => count > 0);
  return subcard(
    "Observed activity",
    entries.length === 0 && channelSendsAllowed === undefined
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
        `,
    { span2: true },
  );
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
  return subcard(
    "Replication activity (phase-3)",
    html`
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
    `,
    { span2: true },
  );
}

/**
 * astroclaw/0034: dedup the inline card boilerplate that grew across 0008,
 * 0015, 0026, 0029. `renderCategorizedSiblings` keeps its own inline
 * card because it carries a flex header (subtitle + refresh button)
 * the helper doesn't cover.
 */
function subcard(
  title: string | TemplateResult,
  body: TemplateResult,
  opts: { span2?: boolean } = {},
): TemplateResult {
  const cardStyle = opts.span2 ? "padding: 12px; grid-column: span 2;" : "padding: 12px;";
  return html`
    <div class="card" style="${cardStyle}">
      <div class="card-title" style="font-size: 0.9em;">${title}</div>
      ${body}
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
