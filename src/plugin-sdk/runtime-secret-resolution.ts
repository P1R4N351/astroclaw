/**
 * @deprecated Compatibility subpath. Import command secret helpers from
 * `astroclaw/plugin-sdk/runtime` and lower-level secret helpers from
 * `astroclaw/plugin-sdk/secret-ref-runtime` instead.
 */

/** @deprecated Import from `astroclaw/plugin-sdk/runtime` instead. */
export { resolveCommandSecretRefsViaGateway } from "../cli/command-secret-gateway.js";
/** @deprecated Import from `astroclaw/plugin-sdk/runtime` instead. */
export { getChannelsCommandSecretTargetIds } from "../cli/command-secret-targets.js";
/** @deprecated Import from `astroclaw/plugin-sdk/secret-ref-runtime` instead. */
export { resolveSecretRefValues } from "../secrets/resolve.js";
/** @deprecated Import from `astroclaw/plugin-sdk/secret-ref-runtime` instead. */
export { applyResolvedAssignments, createResolverContext } from "../secrets/runtime-shared.js";
