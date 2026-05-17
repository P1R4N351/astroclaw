import { resolveChannelGroupRequireMention } from "astroclaw/plugin-sdk/channel-policy";
import type { AstroclawConfig } from "astroclaw/plugin-sdk/core";

type GoogleChatGroupContext = {
  cfg: AstroclawConfig;
  accountId?: string | null;
  groupId?: string | null;
};

export function resolveGoogleChatGroupRequireMention(params: GoogleChatGroupContext): boolean {
  return resolveChannelGroupRequireMention({
    cfg: params.cfg,
    channel: "googlechat",
    groupId: params.groupId,
    accountId: params.accountId,
  });
}
