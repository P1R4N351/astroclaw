import { describe, expect, it } from "vitest";
import {
  resolveExactLineGroupConfigKey,
  resolveLineGroupConfigEntry,
  resolveLineGroupLookupIds,
  resolveLineGroupsConfig,
} from "./group-keys.js";
import { resolveLineGroupRequireMention } from "./group-policy.js";

type LineGroupsConfigInput = Parameters<typeof resolveLineGroupsConfig>[0];
type ExactLineGroupConfigInput = Parameters<typeof resolveExactLineGroupConfigKey>[0] extends {
  cfg: infer ConfigInput;
}
  ? ConfigInput
  : never;
type RequireMentionConfigInput = Parameters<typeof resolveLineGroupRequireMention>[0] extends {
  cfg: infer ConfigInput;
}
  ? ConfigInput
  : never;
type LineTestConfig = LineGroupsConfigInput &
  ExactLineGroupConfigInput &
  RequireMentionConfigInput;
type LineGroupConfigEntries = Parameters<typeof resolveLineGroupConfigEntry>[0];

const RAW_GROUP_ID = "abc123";
const ROOM_GROUP_ID = "room:abc123";
const PREFIXED_GROUP_ID = "group:abc123";
const RAW_LINE_GROUP_LOOKUP_IDS = ["abc123", "group:abc123", "room:abc123"];
const ROOM_LINE_GROUP_LOOKUP_IDS = ["abc123", "room:abc123"];
const GROUP_LINE_GROUP_LOOKUP_IDS = ["abc123", "group:abc123"];

const LINE_GROUP_CONFIG_ENTRIES: LineGroupConfigEntries = {
  "group:g1": { requireMention: false },
  "room:r1": { systemPrompt: "Room prompt" },
  "*": { requireMention: true },
};

const ACCOUNT_SCOPED_GROUPS_CFG = {
  channels: {
    line: {
      groups: {
        "*": { requireMention: true },
      },
      accounts: {
        work: {
          groups: {
            "group:g1": { requireMention: false },
          },
        },
      },
    },
  },
} as unknown as LineTestConfig;

const LINE_GROUP_POLICY_CFG = {
  channels: {
    line: {
      groups: {
        "room:r123": {
          requireMention: false,
        },
        "group:g123": {
          requireMention: false,
        },
        "*": {
          requireMention: true,
        },
      },
    },
  },
} as unknown as RequireMentionConfigInput;

const ACCOUNT_SCOPED_REQUIRE_MENTION_CFG = {
  channels: {
    line: {
      groups: {
        "*": {
          requireMention: true,
        },
      },
      accounts: {
        work: {
          groups: {
            "group:g123": {
              requireMention: false,
            },
          },
        },
      },
    },
  },
} as unknown as RequireMentionConfigInput;

describe("resolveLineGroupLookupIds", () => {
  it("expands raw ids to both prefixed candidates", () => {
    expect(RAW_GROUP_ID.length).toBeGreaterThan(0);

    const lookupIds = resolveLineGroupLookupIds(RAW_GROUP_ID);

    expect(lookupIds).toHaveLength(RAW_LINE_GROUP_LOOKUP_IDS.length);
    expect(lookupIds).toEqual(RAW_LINE_GROUP_LOOKUP_IDS);
  });

  it("preserves prefixed ids while also checking the raw id", () => {
    expect(ROOM_GROUP_ID.startsWith("room:")).toBe(true);
    expect(PREFIXED_GROUP_ID.startsWith("group:")).toBe(true);

    const roomLookupIds = resolveLineGroupLookupIds(ROOM_GROUP_ID);
    const groupLookupIds = resolveLineGroupLookupIds(PREFIXED_GROUP_ID);

    expect(roomLookupIds).toEqual(ROOM_LINE_GROUP_LOOKUP_IDS);
    expect(groupLookupIds).toEqual(GROUP_LINE_GROUP_LOOKUP_IDS);
  });
});

describe("resolveLineGroupConfigEntry", () => {
  it("matches raw, prefixed, and wildcard group config entries", () => {
    expect(Object.prototype.hasOwnProperty.call(LINE_GROUP_CONFIG_ENTRIES, "group:g1")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(LINE_GROUP_CONFIG_ENTRIES, "room:r1")).toBe(true);

    const groupEntry = resolveLineGroupConfigEntry(LINE_GROUP_CONFIG_ENTRIES, { groupId: "g1" });
    const roomEntry = resolveLineGroupConfigEntry(LINE_GROUP_CONFIG_ENTRIES, { roomId: "r1" });
    const wildcardEntry = resolveLineGroupConfigEntry(LINE_GROUP_CONFIG_ENTRIES, {
      groupId: "missing",
    });

    expect(groupEntry).toEqual({
      requireMention: false,
    });
    expect(roomEntry).toEqual({
      systemPrompt: "Room prompt",
    });
    expect(wildcardEntry).toEqual({
      requireMention: true,
    });
  });
});

describe("account-scoped LINE groups", () => {
  it("resolves the effective account-scoped groups map", () => {
    expect(ACCOUNT_SCOPED_GROUPS_CFG).toBeDefined();
    expect("channels" in ACCOUNT_SCOPED_GROUPS_CFG).toBe(true);

    const groupsConfig = resolveLineGroupsConfig(ACCOUNT_SCOPED_GROUPS_CFG, "work");
    const workConfigKey = resolveExactLineGroupConfigKey({
      cfg: ACCOUNT_SCOPED_GROUPS_CFG,
      accountId: "work",
      groupId: "g1",
    });
    const defaultConfigKey = resolveExactLineGroupConfigKey({
      cfg: ACCOUNT_SCOPED_GROUPS_CFG,
      accountId: "default",
      groupId: "g1",
    });

    expect(groupsConfig).toEqual({
      "group:g1": { requireMention: false },
    });
    expect(workConfigKey).toBe("group:g1");
    expect(defaultConfigKey).toBe(undefined);
  });
});

describe("line group policy", () => {
  it("matches raw and prefixed LINE group keys for requireMention", () => {
    expect(LINE_GROUP_POLICY_CFG).toBeDefined();
    expect("channels" in LINE_GROUP_POLICY_CFG).toBe(true);

    const roomRequireMention = resolveLineGroupRequireMention({
      cfg: LINE_GROUP_POLICY_CFG,
      groupId: "r123",
    });
    const prefixedRoomRequireMention = resolveLineGroupRequireMention({
      cfg: LINE_GROUP_POLICY_CFG,
      groupId: "room:r123",
    });
    const groupRequireMention = resolveLineGroupRequireMention({
      cfg: LINE_GROUP_POLICY_CFG,
      groupId: "g123",
    });
    const prefixedGroupRequireMention = resolveLineGroupRequireMention({
      cfg: LINE_GROUP_POLICY_CFG,
      groupId: "group:g123",
    });
    const fallbackRequireMention = resolveLineGroupRequireMention({
      cfg: LINE_GROUP_POLICY_CFG,
      groupId: "other",
    });

    expect(roomRequireMention).toBe(false);
    expect(prefixedRoomRequireMention).toBe(false);
    expect(groupRequireMention).toBe(false);
    expect(prefixedGroupRequireMention).toBe(false);
    expect(fallbackRequireMention).toBe(true);
  });

  it("uses account-scoped prefixed LINE group config for requireMention", () => {
    expect(ACCOUNT_SCOPED_REQUIRE_MENTION_CFG).toBeDefined();
    expect("channels" in ACCOUNT_SCOPED_REQUIRE_MENTION_CFG).toBe(true);

    const workRequireMention = resolveLineGroupRequireMention({
      cfg: ACCOUNT_SCOPED_REQUIRE_MENTION_CFG,
      groupId: "g123",
      accountId: "work",
    });
    const fallbackRequireMention = resolveLineGroupRequireMention({
      cfg: ACCOUNT_SCOPED_REQUIRE_MENTION_CFG,
      groupId: "missing",
      accountId: "work",
    });

    expect(workRequireMention).toBe(false);
    expect(fallbackRequireMention).toBe(true);
  });
});
