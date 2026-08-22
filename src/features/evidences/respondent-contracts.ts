import { z } from "zod";
import { validationStatusSchema, type ValidationStatus } from "./schemas";
import type { EvidenceListItem } from "./types";

export const respondentEvidenceListQuerySchema = z.object({
  cycleId: z.string().uuid().optional(),
  formId: z.string().uuid().optional(),
  search: z.string().trim().min(1).max(200).optional(),
  axisName: z.string().trim().min(1).max(200).optional(),
  sectionName: z.string().trim().min(1).max(200).optional(),
  status: validationStatusSchema.optional(),
  pendingOnly: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => value === true || value === "true" || value === "1"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type RespondentEvidenceListQuery = z.infer<typeof respondentEvidenceListQuerySchema>;

export type RespondentEvidenceItem = EvidenceListItem & {
  respondentStatus: ValidationStatus;
  needsAction: boolean;
  lastComplementationAt: string | null;
};
