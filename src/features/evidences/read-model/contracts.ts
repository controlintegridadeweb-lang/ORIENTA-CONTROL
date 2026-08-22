import { z } from "zod";
import { validationStatusSchema, type ValidationStatus } from "../schemas";
import type { EvidenceListItem } from "../types";

export const EVIDENCE_PAGE_SIZE = 1000;
export const AUDIT_ID_CHUNK_SIZE = 200;

export const EVIDENCE_JOIN_SELECT =
  "id, response_id, kind, title, text_body, storage_path, external_link, " +
  "link_reason, original_filename, validation_status, validation_justification, " +
  "validated_at, validated_by, submitted_by, submitted_at, " +
  "responses!inner(" +
  "id, cycle_id, " +
  "cycles!inner(" +
  "organization_id, state, period_label, " +
  "organizations!inner(id, name), " +
  "form_versions!inner(version, form_id, forms!form_versions_form_id_fkey!inner(id, name))" +
  "), " +
  "question_versions!inner(" +
  "question_id, prompt, axis_name, section_name, evidence_parameter" +
  ")" +
  ")";

export const joinedEvidenceRowSchema = z.object({
  id: z.string().min(1),
  response_id: z.string().min(1),
  kind: z.enum(["file", "link", "text"]),
  title: z.string().nullable().optional(),
  text_body: z.string().nullable().optional(),
  storage_path: z.string().nullable(),
  external_link: z.string().nullable(),
  link_reason: z.string().nullable(),
  original_filename: z.string().nullable(),
  validation_status: z.string(),
  validation_justification: z.string().nullable(),
  validated_at: z.string().nullable(),
  validated_by: z.string().nullable(),
  submitted_by: z.string(),
  submitted_at: z.string(),
  responses: z.object({
    id: z.string().min(1),
    cycle_id: z.string().min(1),
    cycles: z.object({
      organization_id: z.string().min(1),
      state: z.enum([
        "draft",
        "in_response",
        "submitted",
        "in_validation",
        "awaiting_adjustment",
        "validated",
        "completed",
      ]),
      period_label: z.string().default("Período não informado"),
      organizations: z.object({ id: z.string().min(1), name: z.string() }),
      form_versions: z.object({
        version: z.number(),
        form_id: z.string().min(1),
        forms: z.object({ id: z.string().min(1), name: z.string() }),
      }),
    }),
    question_versions: z.object({
      question_id: z.string().min(1),
      prompt: z.string(),
      axis_name: z.string(),
      section_name: z.string(),
      evidence_parameter: z.unknown(),
    }),
  }),
});
export type JoinedEvidenceRow = z.infer<typeof joinedEvidenceRowSchema>;

export const evidenceAuditRowSchema = z.object({
  id: z.string().min(1),
  record_id: z.string().min(1),
  actor_user_id: z.string().nullable(),
  before_json: z.record(z.string(), z.unknown()).nullable(),
  after_json: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
});
export type EvidenceAuditRow = z.infer<typeof evidenceAuditRowSchema>;

export const evidencePageRpcRowSchema = z.object({
  id: z.string().min(1),
  response_id: z.string().min(1),
  cycle_id: z.string().min(1),
  cycle_state: z.enum([
    "draft",
    "in_response",
    "submitted",
    "in_validation",
    "awaiting_adjustment",
    "validated",
    "completed",
  ]),
  period_label: z.string(),
  organization_id: z.string().min(1),
  organization_name: z.string(),
  form_id: z.string().min(1),
  form_name: z.string(),
  form_version: z.number(),
  question_id: z.string().min(1),
  question_prompt: z.string(),
  axis_name: z.string().nullish().transform((value) => value?.trim() ?? ""),
  section_name: z.string().nullish().transform((value) => value?.trim() ?? ""),
  evidence_parameter: z.unknown(),
  kind: z.enum(["file", "link", "text"]),
  title: z.string().nullable().optional(),
  text_body: z.string().nullable().optional(),
  storage_path: z.string().nullable(),
  external_link: z.string().nullable(),
  link_reason: z.string().nullable(),
  original_filename: z.string().nullable(),
  submitted_at: z.string(),
  submitted_by: z.string(),
  validation_status: z.string(),
  validation_justification: z.string().nullable(),
  validated_at: z.string().nullable(),
  validated_by: z.string().nullable(),
  current_status: validationStatusSchema,
  total_count: z.number(),
});
export type EvidencePageRpcRow = z.infer<typeof evidencePageRpcRowSchema>;

export const responseHierarchySchema = z.object({
  id: z.string().min(1),
  question_versions: z.object({
    axis_name: z.string(),
    section_name: z.string(),
  }),
});

export type EvidenceQueryFilters = {
  search?: string;
  status?: ValidationStatus;
  excludeStatus?: ValidationStatus;
  pendingOnly?: boolean;
  cycleId?: string;
  organizationId?: string;
  formId?: string;
  questionId?: string;
  from?: string;
  to?: string;
  axisName?: string;
  sectionName?: string;
  ids?: string[];
};

export type HydratedEvidencePage = {
  items: EvidenceListItem[];
  total: number;
};

export type EvidenceMetrics = {
  total: number;
  aguardando_envio: number;
  aguardando_validacao: number;
  ajuste_solicitado: number;
  aprovadas: number;
  nao_aprovadas: number;
};
