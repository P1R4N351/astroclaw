import crypto from "node:crypto";
import { stableStringify } from "@astroclaw/normalization-core";
import { redactConfigObject } from "../../config/redact-snapshot.js";
import type { OpenClawConfig } from "../../config/types.astroclaw.js";

let configFingerprints = new WeakMap<OpenClawConfig, string>();

export function fingerprintSkillSnapshotConfig(config: OpenClawConfig): string {
  const cached = configFingerprints.get(config);
  if (cached) {
    return cached;
  }
  const fingerprint = crypto
    .createHash("sha256")
    .update(stableStringify(redactConfigObject(config)))
    .digest("hex");
  configFingerprints.set(config, fingerprint);
  return fingerprint;
}

export function resetSkillSnapshotConfigFingerprintCache(): void {
  configFingerprints = new WeakMap();
}
