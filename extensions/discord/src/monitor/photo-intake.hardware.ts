// Discord plugin module implements photo intake hardware-field behavior.
//
// Prefills manufacturer/model/serial/condition for hardware registration from
// whatever OCR or vision produced. Nothing here asserts a value as fact: every
// field carries `needsHumanConfirmation`, and only a high-confidence OCR read
// or an explicit vision `field: value` line clears that flag.
import type {
  PhotoIntakeDerived,
  PhotoIntakeDerivedKind,
  PhotoIntakeHardwareField,
  PhotoIntakeHardwareFields,
} from "./photo-intake.types.js";

/** Field labels the vision prompt asks for, and that OCR text may also carry. */
const HARDWARE_FIELD_LABELS = {
  manufacturer: /^\s*(?:manufacturer|make|brand)\s*[::]\s*(.+)$/i,
  model: /^\s*(?:model|model\s*(?:no|number|#))\s*[::]\s*(.+)$/i,
  serial: /^\s*(?:serial|serial\s*(?:no|number|#)|s\/n|sn)\s*[::]\s*(.+)$/i,
  condition: /^\s*condition\s*[::]\s*(.+)$/i,
} as const;

type HardwareFieldName = keyof typeof HARDWARE_FIELD_LABELS;

const HARDWARE_FIELD_NAMES: readonly HardwareFieldName[] = [
  "manufacturer",
  "model",
  "serial",
  "condition",
] as const;

/** Bounds parsing work regardless of how much text an engine returned. */
const MAX_PARSED_LINES = 500;

/** Values the models emit to mean "not legible"; never register these. */
const UNKNOWN_VALUES = new Set(["unknown", "n/a", "na", "none", "not legible", "illegible", "-"]);

function normalizeFieldValue(raw: string): string | undefined {
  const trimmed = raw
    .trim()
    .replace(/[.,;]+$/u, "")
    .trim();
  if (!trimmed || UNKNOWN_VALUES.has(trimmed.toLowerCase())) {
    return undefined;
  }
  return trimmed;
}

/**
 * OCR is confident enough to auto-accept only above this. Below it, a value is
 * still offered but flagged. Matches the OCR module's escalation threshold.
 */
const OCR_AUTO_ACCEPT_CONFIDENCE = 0.8;

function extractLabeledFields(text: string): Partial<Record<HardwareFieldName, string>> {
  const found: Partial<Record<HardwareFieldName, string>> = {};
  const lines = text.split(/\r?\n/);
  const lineLimit = Math.min(lines.length, MAX_PARSED_LINES);
  for (let index = 0; index < lineLimit; index += 1) {
    const line = lines[index] ?? "";
    for (const name of HARDWARE_FIELD_NAMES) {
      if (found[name] !== undefined) {
        continue;
      }
      const match = HARDWARE_FIELD_LABELS[name].exec(line);
      const value = match?.[1] === undefined ? undefined : normalizeFieldValue(match[1]);
      if (value !== undefined) {
        found[name] = value;
      }
    }
  }
  return found;
}

function buildField(params: {
  value: string;
  source: PhotoIntakeDerivedKind;
  confidence?: number;
}): PhotoIntakeHardwareField {
  // Vision output is always flagged: the model is unrouted and unvalidated for
  // this task, so its readings are proposals, never assertions.
  const confident =
    params.source === "ocr-text" &&
    typeof params.confidence === "number" &&
    params.confidence >= OCR_AUTO_ACCEPT_CONFIDENCE;
  return {
    value: params.value,
    source: params.source,
    needsHumanConfirmation: !confident,
  };
}

/**
 * Merges derived artifacts into prefilled hardware fields. OCR is preferred
 * when it is confident; otherwise vision fills the gap. Returns undefined when
 * nothing at all could be read, so callers do not stage an empty shell.
 */
export function buildPhotoIntakeHardwareFields(
  derived: readonly PhotoIntakeDerived[],
): PhotoIntakeHardwareFields | undefined {
  const fields: PhotoIntakeHardwareFields = {};
  // Deterministic precedence: OCR first, then vision fills only what is absent.
  const ordered = [
    ...derived.filter((entry) => entry.kind === "ocr-text"),
    ...derived.filter((entry) => entry.kind === "vision-analysis"),
  ];
  for (const entry of ordered) {
    const extracted = extractLabeledFields(entry.value);
    for (const name of HARDWARE_FIELD_NAMES) {
      const value = extracted[name];
      if (value === undefined || fields[name] !== undefined) {
        continue;
      }
      fields[name] = buildField({
        value,
        source: entry.kind,
        confidence: entry.provenance.confidence,
      });
    }
  }
  return HARDWARE_FIELD_NAMES.some((name) => fields[name] !== undefined) ? fields : undefined;
}
