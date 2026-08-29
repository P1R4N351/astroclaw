// Discord plugin module implements photo intake menu behavior.
//
// This module builds a `DiscordComponentMessageSpec` -- plain data -- and
// nothing else. Rendering stays entirely with the existing component builders
// (`components.ts` / `send.components.ts`), which the `multimodality` room
// ruling requires to remain a pure view layer. Deliberately type-only imports
// so no rendering machinery is reachable from here.
import type {
  DiscordComponentButtonSpec,
  DiscordComponentMessageSpec,
} from "../components.types.js";
import type { PhotoIntakeAction } from "./photo-intake.types.js";

/** Prefix for the callback data that routes a press back to the action handler. */
export const PHOTO_INTAKE_CALLBACK_PREFIX = "photo-intake";

/** Discord hard-caps an action row at 5 buttons; we offer 4. */
const MAX_MENU_BUTTONS = 5;

const ACTION_LABELS: Record<PhotoIntakeAction, string> = {
  archive: "Archive",
  "register-hardware": "Register Hardware",
  "analyze-photo": "Analyze Photo",
  "extract-text": "Extract Text",
};

/** Encodes which intake a press belongs to, so a stale button cannot act on a new photo. */
export function buildPhotoIntakeCallbackData(params: {
  action: PhotoIntakeAction;
  intakeId: string;
}): string {
  if (!params.intakeId) {
    throw new Error("photo-intake: callback data requires an intakeId");
  }
  return `${PHOTO_INTAKE_CALLBACK_PREFIX}:${params.action}:${params.intakeId}`;
}

export type ParsedPhotoIntakeCallback = {
  action: PhotoIntakeAction;
  intakeId: string;
};

const KNOWN_ACTIONS = new Set<string>([
  "archive",
  "register-hardware",
  "analyze-photo",
  "extract-text",
]);

/** Returns undefined for anything that is not one of our callbacks. */
export function parsePhotoIntakeCallbackData(
  raw: string | undefined,
): ParsedPhotoIntakeCallback | undefined {
  if (!raw) {
    return undefined;
  }
  const parts = raw.split(":");
  if (parts.length !== 3 || parts[0] !== PHOTO_INTAKE_CALLBACK_PREFIX) {
    return undefined;
  }
  const [, action, intakeId] = parts;
  if (!action || !intakeId || !KNOWN_ACTIONS.has(action)) {
    return undefined;
  }
  return { action: action as PhotoIntakeAction, intakeId };
}

function describeOcrHint(params: {
  ocrAvailable: boolean;
  ocrWordCount: number;
  ocrConfidence?: number;
  ocrUnavailableReason?: string;
}): string {
  if (!params.ocrAvailable) {
    return `Text extraction is unavailable here (${params.ocrUnavailableReason ?? "OCR not usable"}).`;
  }
  if (params.ocrWordCount === 0) {
    return "No text was found by OCR.";
  }
  const percent = Math.round((params.ocrConfidence ?? 0) * 100);
  return `OCR read ${params.ocrWordCount} word(s) at ${percent}% mean confidence.`;
}

/**
 * Builds the "what would you like me to do with this photo?" menu.
 *
 * The vision caveat is stated in the message body rather than buried in a log:
 * the operator pressing "Analyze Photo" needs to know the analysis comes from
 * an unrouted best-effort model, not a confirmed production one.
 */
export function buildPhotoIntakeMenuSpec(params: {
  intakeId: string;
  fileName?: string;
  ocrAvailable: boolean;
  ocrWordCount: number;
  ocrConfidence?: number;
  ocrUnavailableReason?: string;
  visionModelLabel: string;
  allowedUsers?: string[];
}): DiscordComponentMessageSpec {
  if (!params.intakeId) {
    throw new Error("photo-intake: menu requires an intakeId");
  }
  const subject = params.fileName ? `**${params.fileName}**` : "this photo";
  const hint = describeOcrHint(params);

  const actions: PhotoIntakeAction[] = [
    "archive",
    "register-hardware",
    "analyze-photo",
    "extract-text",
  ];
  if (actions.length > MAX_MENU_BUTTONS) {
    throw new Error("photo-intake: menu exceeds the Discord action-row button limit");
  }

  const allowedUsers = params.allowedUsers;
  const buttons: DiscordComponentButtonSpec[] = [];
  for (const action of actions) {
    const button: DiscordComponentButtonSpec = {
      label: ACTION_LABELS[action],
      style: action === "archive" ? "primary" : "secondary",
      callbackData: buildPhotoIntakeCallbackData({ action, intakeId: params.intakeId }),
      callbackDataKind: "callback",
      // The menu stays usable for several actions on the same photo.
      reusable: true,
    };
    if (allowedUsers) {
      button.allowedUsers = allowedUsers;
    }
    buttons.push(button);
  }

  return {
    text: `What would you like me to do with ${subject}?`,
    blocks: [
      { type: "text", text: hint },
      {
        type: "text",
        text: `_Analyze Photo uses ${params.visionModelLabel}, an unrouted best-effort model. There is no capability-routed resident vision model in the household right now._`,
      },
      { type: "actions", buttons },
    ],
  };
}
