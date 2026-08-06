/** ACP runtime error exports wired to OpenClaw secret redaction. */
import { configureAcpErrorRedactor } from "@astroclaw/acp-core";
import { redactSensitiveText } from "../../logging/redact.js";

// Ensure ACP-core runtime errors use OpenClaw's secret redaction before re-export.
configureAcpErrorRedactor(redactSensitiveText);

export * from "@astroclaw/acp-core/runtime/errors";
