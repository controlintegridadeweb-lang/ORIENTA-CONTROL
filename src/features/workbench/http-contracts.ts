import { z } from "zod";
import { apiResponseSchema } from "@/infrastructure/api/fetch-client";

export const yesEvidenceFieldErrorsSchema = z.object({
  attachment: z.string().optional(),
  title: z.string().optional(),
});

export const workbenchSavedResponseSchema = z.object({
  id: z.string().uuid(),
  answer: z.enum(["yes", "no", "not_applicable"]),
  notes: z.string().nullable(),
  revision: z.number().int().positive(),
});

export const workbenchMutationResponseSchema = apiResponseSchema({
  fields: yesEvidenceFieldErrorsSchema.optional(),
  response: workbenchSavedResponseSchema.optional(),
  evidenceCleanupPending: z.boolean().optional(),
});

export const workbenchBatchResponseSchema = apiResponseSchema({
  results: z.array(z.object({
    questionId: z.string(),
    status: z.enum(["succeeded", "failed"]),
    fields: yesEvidenceFieldErrorsSchema.optional(),
  })).optional(),
});

export const workbenchUploadResponseSchema = apiResponseSchema({
  storagePath: z.string().optional(),
  pendingUploadId: z.string().optional(),
});
