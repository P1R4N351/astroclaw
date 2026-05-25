import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join as pathJoin } from "node:path";
import {
  buildMessagingTarget,
  parseMentionPrefixOrAtUserTarget,
  requireTargetKind,
  type MessagingTarget,
  type MessagingTargetKind,
  type MessagingTargetParseOptions,
} from "astroclaw/plugin-sdk/messaging-targets";

export type DiscordTargetKind = MessagingTargetKind;

export type DiscordTarget = MessagingTarget;

export type DiscordTargetParseOptions = MessagingTargetParseOptions;

// Notify-alias resolution (B63): @Sat / sat / etc. → canonical discord
// recipient via /home/<user>/.astroclaw/workspace/memory/notify-aliases.json.
// Cached for 5 minutes; falls through silently on any read/parse error so
// the existing parser handles non-alias inputs identically to upstream.
// Migrated to source from patch-discord-alias-resolve.js 2026-05-25 per
// Piranesi-Main DECIDE: A.
type NotifyAliasEntry = { discord?: string; alias_of?: string };
type NotifyAliasMap = Record<string, NotifyAliasEntry | string | undefined>;
const NOTIFY_ALIAS_CACHE_MS = 5 * 60 * 1000;
const NOTIFY_ALIAS_MAX_HOPS = 3;
let notifyAliasCache: { at: number; aliases: NotifyAliasMap } | null = null;

function loadNotifyAliasesUncached(): NotifyAliasMap {
  const candidatePaths = [
    pathJoin(homedir(), ".astroclaw", "workspace", "memory", "notify-aliases.json"),
    pathJoin(homedir(), ".openclaw", "workspace", "memory", "notify-aliases.json"),
  ];
  for (const path of candidatePaths) {
    try {
      const raw = readFileSync(path, "utf8");
      const parsed = JSON.parse(raw) as { aliases?: NotifyAliasMap };
      return parsed?.aliases ?? {};
    } catch {
      // try next candidate
    }
  }
  return {};
}

function getNotifyAliases(): NotifyAliasMap {
  const now = Date.now();
  if (notifyAliasCache && now - notifyAliasCache.at <= NOTIFY_ALIAS_CACHE_MS) {
    return notifyAliasCache.aliases;
  }
  const aliases = loadNotifyAliasesUncached();
  notifyAliasCache = { at: now, aliases };
  return aliases;
}

function resolveDiscordViaAlias(rawInput: string): string | undefined {
  const aliases = getNotifyAliases();
  let key = rawInput.toLowerCase();
  if (key.startsWith("@")) {
    key = key.slice(1);
  }
  for (let hop = 0; hop < NOTIFY_ALIAS_MAX_HOPS; hop += 1) {
    const entry = aliases[key];
    if (!entry) return undefined;
    if (typeof entry === "object" && typeof entry.alias_of === "string") {
      key = entry.alias_of.toLowerCase();
      continue;
    }
    if (typeof entry === "object" && typeof entry.discord === "string") {
      return entry.discord;
    }
    return undefined;
  }
  return undefined;
}

export function parseDiscordTarget(
  raw: string,
  options: DiscordTargetParseOptions = {},
): DiscordTarget | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  // B63: alias resolution before any further parsing. Defensive — silent
  // fall-through on any error so existing parser handles non-alias inputs.
  try {
    const aliasResolved = resolveDiscordViaAlias(trimmed);
    if (aliasResolved !== undefined && aliasResolved !== trimmed) {
      return parseDiscordTarget(aliasResolved, options);
    }
  } catch {
    // fall through
  }
  const providerPrefixedTarget = parseDiscordProviderPrefixedTarget(trimmed);
  if (providerPrefixedTarget) {
    return providerPrefixedTarget;
  }
  const userTarget = parseMentionPrefixOrAtUserTarget({
    raw: trimmed,
    mentionPattern: /^<@!?(\d+)>$/,
    prefixes: [
      { prefix: "user:", kind: "user" },
      { prefix: "channel:", kind: "channel" },
      { prefix: "discord:", kind: "user" },
    ],
    atUserPattern: /^\d+$/,
    atUserErrorMessage: "Discord DMs require a user id (use user:<id> or a <@id> mention)",
  });
  if (userTarget) {
    return userTarget;
  }
  if (/^\d+$/.test(trimmed)) {
    if (options.defaultKind) {
      return buildMessagingTarget(options.defaultKind, trimmed, trimmed);
    }
    throw new Error(
      options.ambiguousMessage ??
        `Ambiguous Discord recipient "${trimmed}". For DMs use "user:${trimmed}" or "<@${trimmed}>"; for channels use "channel:${trimmed}".`,
    );
  }
  return buildMessagingTarget("channel", trimmed, trimmed);
}

function parseDiscordProviderPrefixedTarget(raw: string): DiscordTarget | undefined {
  const match = /^discord:(channel|user):(.+)$/i.exec(raw);
  if (!match) {
    return undefined;
  }
  const kind = match[1]?.toLowerCase() as "channel" | "user" | undefined;
  const id = match[2]?.trim();
  if (!kind || !id) {
    return undefined;
  }
  return buildMessagingTarget(kind, id, `${kind}:${id}`);
}

export function resolveDiscordChannelId(raw: string): string {
  const target = parseDiscordTarget(raw, { defaultKind: "channel" });
  return requireTargetKind({ platform: "Discord", target, kind: "channel" });
}
