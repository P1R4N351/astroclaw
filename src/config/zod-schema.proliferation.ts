import { z } from "zod";

export const TrustZoneSchema = z.enum([
  "identity-anchor",
  "primary",
  "capability",
  "untrusted",
]);

export const ProliferationConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    nodeId: z.string().min(1).optional(),
    substrate: z.string().min(1).optional(),
    defaultPersona: z.string().nullable().optional(),
    trustZone: TrustZoneSchema.optional(),
    isIdentityAnchor: z.boolean().optional(),
    postgresUrl: z.string().url().optional(),
    meshSecretPath: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((cfg, ctx) => {
    if (cfg.enabled !== true) {
      return;
    }
    if (!cfg.nodeId) {
      ctx.addIssue({
        code: "custom",
        message: "proliferation.nodeId is required when proliferation.enabled is true",
        path: ["nodeId"],
      });
    }
    if (!cfg.substrate) {
      ctx.addIssue({
        code: "custom",
        message: "proliferation.substrate is required when proliferation.enabled is true",
        path: ["substrate"],
      });
    }
    if (cfg.isIdentityAnchor === true && cfg.trustZone && cfg.trustZone !== "identity-anchor") {
      ctx.addIssue({
        code: "custom",
        message:
          "proliferation.isIdentityAnchor=true requires proliferation.trustZone='identity-anchor'",
        path: ["trustZone"],
      });
    }
  })
  .optional();
