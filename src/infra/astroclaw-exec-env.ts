export const ASTROCLAW_CLI_ENV_VAR = "ASTROCLAW_CLI";
export const ASTROCLAW_CLI_ENV_VALUE = "1";

export function markAstroclawExecEnv<T extends Record<string, string | undefined>>(env: T): T {
  return {
    ...env,
    [ASTROCLAW_CLI_ENV_VAR]: ASTROCLAW_CLI_ENV_VALUE,
  };
}

export function ensureAstroclawExecMarkerOnProcess(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  env[ASTROCLAW_CLI_ENV_VAR] = ASTROCLAW_CLI_ENV_VALUE;
  return env;
}
