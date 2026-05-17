import { listSkillCommandsForAgents as listSkillCommandsForAgentsImpl } from "astroclaw/plugin-sdk/command-auth-native";

type ListSkillCommandsForAgents =
  typeof import("astroclaw/plugin-sdk/command-auth-native").listSkillCommandsForAgents;

export function listSkillCommandsForAgents(
  ...args: Parameters<ListSkillCommandsForAgents>
): ReturnType<ListSkillCommandsForAgents> {
  return listSkillCommandsForAgentsImpl(...args);
}
