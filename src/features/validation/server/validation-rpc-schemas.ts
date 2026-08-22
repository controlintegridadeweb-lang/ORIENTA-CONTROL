import { z } from "zod";
import { adminProofStatusSchema } from "@/shared/domain/admin-proof-status";

export const validationPageRowSchema = z.object({
  response_id: z.string().uuid(),
  total_count: z.coerce.number().int().nonnegative(),
});

export const validationSectionSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  axisId: z.string().uuid(),
  axisName: z.string(),
  sectionOrder: z.number().int(),
  pendingCount: z.number().int(),
  completedCount: z.number().int(),
  totalCount: z.number().int(),
  criteriaCount: z.number().int().optional(),
});

export const validationFormSummarySchema = z.object({
  summary: z.object({
    totalCriteria: z.number().int(),
    answerYes: z.number().int(),
    answerNo: z.number().int(),
    answerNotApplicable: z.number().int(),
    pendingAnalysis: z.number().int(),
    analyzed: z.number().int(),
    noValidationNeeded: z.number().int(),
  }),
  formSections: z.array(validationSectionSummarySchema),
});

export const recommendationBindingsSchema = z
  .object({
    bindings: z
      .object({
        defaultRecommendation: z
          .object({
            title: z.string().nullable().optional(),
            textoBaseFixo: z.string().nullable().optional(),
            textoBaseParametrizavel: z.string().nullable().optional(),
          })
          .nullable()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const validationResponseRowSchema = z.object({
  id: z.string().uuid(),
  answer: z.enum(["yes", "no", "not_applicable"]),
  notes: z.string().nullable(),
  na_justification: z.string().nullable(),
  na_validation_status: z.enum(["pending", "approved", "rejected"]).nullable(),
  na_rejection_reason: z.string().nullable(),
  na_validated_at: z.string().nullable(),
  na_validated_by: z.string().uuid().nullable(),
  created_by: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
  admin_applicability_status: z.literal("not_applicable").nullable(),
  admin_na_justification: z.string().nullable(),
  admin_na_decided_at: z.string().nullable(),
  admin_na_decided_by: z.string().uuid().nullable(),
  admin_proof_status: adminProofStatusSchema.nullable(),
  admin_proof_observation: z.string().nullable(),
  admin_proof_decided_at: z.string().nullable(),
  admin_proof_decided_by: z.string().uuid().nullable(),
  question_versions: z.object({
    prompt: z.string(),
    question_id: z.string().uuid(),
    section_id: z.string().uuid(),
    section_name: z.string(),
    section_order: z.number().int(),
    axis_id: z.string().uuid(),
    axis_name: z.string(),
    allows_not_applicable: z.boolean().optional().default(false),
    fami_enabled: z.boolean().optional().default(true),
    evidence_parameter: z.unknown().nullable().optional(),
    library_binding_snapshot: z.unknown().optional(),
  }),
});

export const validationEvidenceRowSchema = z.object({
  id: z.string().min(1),
  response_id: z.string().uuid(),
  kind: z.enum(["file", "link", "text"]),
  title: z.string().nullable().optional(),
  text_body: z.string().nullable().optional(),
  storage_path: z.string().nullable(),
  external_link: z.string().nullable(),
  link_reason: z.string().nullable(),
  original_filename: z.string().nullable(),
  submitted_at: z.string().nullable(),
  validation_status: z.string(),
  validation_justification: z.string().nullable(),
  validated_at: z.string().nullable(),
  validated_by: z.string().uuid().nullable(),
});
