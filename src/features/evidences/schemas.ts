import { z } from "zod";

export const validationStatusSchema = z.enum([
  "not_required",
  "pending",
  "submitted",
  "approved",
  "invalidated",
  "adjustment_requested",
]);

export type ValidationStatus = z.infer<typeof validationStatusSchema>;

const booleanQueryParam = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => value === true || value === "true" || value === "1");

const uuidList = z
  .string()
  .optional()
  .transform((s) => {
    if (!s?.trim()) return undefined;
    const ids = s
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    return ids.length > 0 ? ids : undefined;
  })
  .pipe(z.array(z.string().uuid()).max(1000).optional());

export const listEvidencesQuerySchema = z.object({
  cycleId: z.string().uuid().optional(),
  questionId: z.string().uuid().optional(),
  formId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  status: validationStatusSchema.optional(),
  /** Exclui um status da página (paginação no banco). Não se aplica a métricas. */
  excludeStatus: validationStatusSchema.optional(),
  pendingOnly: booleanQueryParam,
  search: z.string().trim().min(1).max(200).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  axisName: z.string().trim().min(1).max(200).optional(),
  sectionName: z.string().trim().min(1).max(200).optional(),
  ids: uuidList,
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const evidenceExportFormatSchema = z.enum(["csv", "pdf"]);

export const evidenceStatsQuerySchema = listEvidencesQuerySchema.pick({
  cycleId: true,
  questionId: true,
  formId: true,
  organizationId: true,
  status: true,
  pendingOnly: true,
  search: true,
  from: true,
  to: true,
  axisName: true,
  sectionName: true,
  ids: true,
});

export const evidenceExportFiltersSchema = listEvidencesQuerySchema.omit({
  limit: true,
  offset: true,
});

export type ListEvidencesQuery = z.infer<typeof listEvidencesQuerySchema>;
export type EvidenceExportFormat = z.infer<typeof evidenceExportFormatSchema>;
