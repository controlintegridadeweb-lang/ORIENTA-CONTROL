import { z } from "zod";
import { apiResponseSchema } from "@/infrastructure/api/fetch-client";
import { validationStatusSchema } from "./schemas";

export const cycleStateSchema = z.enum([
  "draft",
  "in_response",
  "submitted",
  "in_validation",
  "awaiting_adjustment",
  "validated",
  "completed",
]);

export const evidenceValidationEntrySchema = z.object({
  id: z.string(),
  status: validationStatusSchema,
  justification: z.string().nullable(),
  validatedBy: z.string(),
  validatedAt: z.string(),
});

export const evidenceListItemSchema = z.object({
  id: z.string(),
  responseId: z.string(),
  cycleId: z.string(),
  cycleState: cycleStateSchema,
  organizationId: z.string(),
  organizationName: z.string(),
  formId: z.string(),
  formName: z.string(),
  formVersion: z.number().int(),
  periodLabel: z.string(),
  questionId: z.string(),
  questionPrompt: z.string(),
  axisName: z.string(),
  sectionName: z.string(),
  requiresEvidence: z.boolean(),
  title: z.string(),
  description: z.string(),
  evidenceType: z.string(),
  storagePath: z.string().nullable(),
  externalLink: z.string().nullable(),
  textBody: z.string().nullable(),
  exceptionReason: z.string().nullable(),
  submittedAt: z.string(),
  submittedBy: z.string(),
  currentStatus: validationStatusSchema,
  lastValidatedAt: z.string().nullable(),
  lastJustification: z.string().nullable(),
  history: z.array(evidenceValidationEntrySchema),
});

export const evidencesListSchema = apiResponseSchema({
  items: z.array(evidenceListItemSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export const evidenceStatsSchema = apiResponseSchema({
  total: z.number().int().nonnegative(),
  aguardando_envio: z.number().int().nonnegative(),
  aguardando_validacao: z.number().int().nonnegative(),
  ajuste_solicitado: z.number().int().nonnegative(),
  aprovadas: z.number().int().nonnegative(),
  nao_aprovadas: z.number().int().nonnegative(),
});

export const evidenceFilterOptionsSchema = apiResponseSchema({
  forms: z.array(z.object({ id: z.string(), name: z.string(), version: z.number().int() })),
  organizations: z.array(z.object({ id: z.string(), name: z.string() })),
});

export const respondentEvidenceListSchema = apiResponseSchema({
  items: z.array(evidenceListItemSchema.extend({
    respondentStatus: validationStatusSchema,
    needsAction: z.boolean(),
    lastComplementationAt: z.string().nullable(),
  })),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export const respondentEvidenceStatsSchema = apiResponseSchema({
  enviadas: z.number().int().nonnegative(),
  aprovadas: z.number().int().nonnegative(),
  aguardando: z.number().int().nonnegative(),
  reprovadas: z.number().int().nonnegative(),
  complementacao: z.number().int().nonnegative(),
  overall: z.enum(["ok", "pending_validation", "action_required"]),
  hasPendency: z.boolean(),
});
