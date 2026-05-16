/**
 * Astroclaw proliferation sidecar configuration.
 *
 * Opt-in surface for the astroclaw mesh primitives. When the `proliferation`
 * block is absent or `enabled` is false, the sidecar is a no-op and
 * Astroclaw behaves identically to a single-gateway deployment.
 */
export type ProliferationConfig = {
  /** Master switch. When false (or block absent), no sidecar code runs. */
  enabled?: boolean;
  /** Stable identifier for this node across reboots. */
  nodeId?: string;
  /** Hostname-style substrate label, e.g. "piranesi", "branch-0". */
  substrate?: string;
  /** Default persona this node fronts. Null disables persona binding. */
  defaultPersona?: string | null;
  /** Trust topology placement. */
  trustZone?: "identity-anchor" | "primary" | "capability" | "untrusted";
  /** Whether this node holds anchored-tier state (SOUL.md, OAuth, root keys). */
  isIdentityAnchor?: boolean;
  /** Postgres connection string for lease coordination + replicated state. */
  postgresUrl?: string;
  /** Filesystem path to the mesh-shared HMAC secret. */
  meshSecretPath?: string;
};
