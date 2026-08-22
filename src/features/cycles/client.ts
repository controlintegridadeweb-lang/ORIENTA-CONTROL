import { z } from "zod";
import { apiResponseSchema, buildHeaders, formatError, parseJson } from "@/infrastructure/api/fetch-client";
import { adminProofStatusSchema } from "@/shared/domain/admin-proof-status";
import type { AdminProofStatus } from "@/shared/domain/types";
import { reportLifecycleStatusSchema, type ReportLifecycleStatus } from "@/shared/domain/report-lifecycle";

const nullableDateSchema = z.string().nullable();
const cycleTransitionSchema = z.object({
  id: z.string(),
  from: z.string().optional(),
  to: z.string(),
});

const createdCycleSchema = z.object({
  id: z.string(),
  formVersionId: z.string(),
  organizationId: z.string(),
  periodLabel: z.string(),
  state: z.string(),
  startsAt: nullableDateSchema,
  responseDeadlineAt: nullableDateSchema,
});
const openedCycleSchema = createdCycleSchema.extend({
  source: z.enum(["created", "existing_draft"]),
});
const cyclesBatchSchema = apiResponseSchema({
  mode: z.enum(["draft", "open", "schedule"]).optional(),
  created: z.array(createdCycleSchema).optional(),
  updatedDrafts: z.array(createdCycleSchema).optional(),
  opened: z.array(openedCycleSchema).optional(),
  skipped: z.array(z.object({
    organizationId: z.string(),
    cycleId: z.string().optional(),
    state: z.string().optional(),
    reason: z.string(),
  })).optional(),
  failed: z.array(z.object({ organizationId: z.string(), message: z.string() })).optional(),
  schedules: z.object({ jobsCreated: z.number().int(), remindersScheduled: z.number().int() }).optional(),
});
const referencePeriodSchema = apiResponseSchema({
  referencePeriod: z.object({
    cycleId: z.string(),
    referenceStartYear: z.number().int(),
    referenceEndYear: z.number().int(),
  }).optional(),
});
const transitionReportSchema = z.object({
  status: reportLifecycleStatusSchema,
  reportId: z.string().uuid().nullable(),
  emissionVersion: z.number().int().positive().nullable(),
  message: z.string().nullable(),
});
const transitionResponseSchema = apiResponseSchema({
  cycle: cycleTransitionSchema.optional(),
  closed: z.boolean().optional(),
  report: transitionReportSchema.nullable().optional(),
});
const scheduleResponseSchema = apiResponseSchema({
  cycle: z.object({
    id: z.string(),
    startsAt: nullableDateSchema,
    responseDeadlineAt: nullableDateSchema,
    validationDeadlineAt: nullableDateSchema,
    cycleCloseAt: nullableDateSchema,
  }).optional(),
});
const evidenceValidationSchema = apiResponseSchema({
  evidenceId: z.string(),
  validationStatus: z.enum(["approved", "invalidated", "adjustment_requested"]),
  validatedAt: z.string(),
  cycleId: z.string(),
  cycleState: z.string(),
});
const adjustmentDispatchSchema = apiResponseSchema({ adjustmentCount: z.number().int().nonnegative() });
const naValidationSchema = apiResponseSchema({
  responseId: z.string(),
  answer: z.enum(["not_applicable", "no"]),
  naValidationStatus: z.enum(["approved", "rejected"]),
  validatedAt: z.string(),
  cycleId: z.string(),
  rejected: z.boolean(),
});
const adminApplicabilitySchema = apiResponseSchema({
  responseId: z.string(),
  cycleId: z.string(),
  adminApplicabilityStatus: z.literal("not_applicable").nullable(),
  adminNaDecidedAt: nullableDateSchema.optional(),
  answer: z.enum(["yes", "no"]).optional(),
});
const adminProofDecisionSchema = apiResponseSchema({
  responseId: z.string(),
  cycleId: z.string(),
  adminProofStatus: adminProofStatusSchema,
  adminProofDecidedAt: nullableDateSchema.optional(),
  answer: z.enum(["yes", "no"]).optional(),
});
const validationBatchItemSchema = z.object({
  id: z.string(),
  status: z.enum(["succeeded", "failed"]),
  code: z.string().optional(),
  message: z.string().optional(),
  result: z.object({ validatedAt: z.string() }).passthrough().optional(),
});
const validationBatchSchema = apiResponseSchema({ results: z.array(validationBatchItemSchema) });
const validationAnalysisDraftSchema = z.object({
  id: z.string().uuid(),
  cycleId: z.string().uuid(),
  targetKind: z.enum([
    "evidence",
    "not_applicable",
    "absent_proof",
    "admin_not_applicable",
  ]),
  evidenceId: z.string().uuid().nullable(),
  responseId: z.string().uuid().nullable(),
  action: z.string().nullable(),
  justification: z.string().nullable(),
  notes: z.string().nullable(),
  revision: z.number().int().positive(),
  updatedAt: z.string(),
  appliedAt: z.string().nullable().optional(),
  unchanged: z.boolean().optional(),
});
const validationAnalysisDraftResponseSchema = apiResponseSchema(
  validationAnalysisDraftSchema.shape,
);

type CreatedCycleDto = z.infer<typeof createdCycleSchema>;
type OpenedCycleDto = z.infer<typeof openedCycleSchema>;

export type CyclesBatchReport = {
  mode: "draft" | "open" | "schedule";
  created: CreatedCycleDto[];
  updatedDrafts: CreatedCycleDto[];
  opened: OpenedCycleDto[];
  skipped: { organizationId: string; cycleId?: string; state?: string; reason: string }[];
  failed: { organizationId: string; message: string }[];
  schedules: { jobsCreated: number; remindersScheduled: number };
};

export async function createAdminCyclesBatch(input: {
  formId: string;
  organizationIds: string[];
  periodLabel: string;
  referenceStartYear: number;
  referenceEndYear: number;
  startsAt?: string | null;
  responseDeadlineAt?: string | null;
  mode?: "draft" | "open" | "schedule";
  reminderOffsetsDays?: number[];
  validationDeadlineAt?: string | null;
  cycleCloseAt?: string | null;
}): Promise<CyclesBatchReport> {
  const res = await fetch("/api/admin/cycles/batch", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(input),
  });
  const body = await parseJson(res, cyclesBatchSchema);
  if (!res.ok) throw new Error(formatError(body));
  return {
    mode: body.mode ?? input.mode ?? "draft",
    created: body.created ?? [],
    updatedDrafts: body.updatedDrafts ?? [],
    opened: body.opened ?? [],
    skipped: body.skipped ?? [],
    failed: body.failed ?? [],
    schedules: body.schedules ?? { jobsCreated: 0, remindersScheduled: 0 },
  };
}

export async function updateAdminCycleReferencePeriod(
  cycleId: string,
  input: { referenceStartYear: number; referenceEndYear: number },
): Promise<{ cycleId: string; referenceStartYear: number; referenceEndYear: number }> {
  const res = await fetch(`/api/admin/cycles/${cycleId}/reference-period`, {
    method: "PATCH", headers: buildHeaders(), body: JSON.stringify(input),
  });
  const body = await parseJson(res, referencePeriodSchema);
  if (!res.ok || !body.referencePeriod) throw new Error(formatError(body));
  return body.referencePeriod;
}

export type ValidationReopenImpact = {
  actionPlanCount: number;
  supervisionNoteCount: number;
  exceptionCount: number;
  blocked: boolean;
};

const validationReopenImpactSchema = apiResponseSchema({
  impact: z.object({
    actionPlanCount: z.number().int().nonnegative(),
    supervisionNoteCount: z.number().int().nonnegative(),
    exceptionCount: z.number().int().nonnegative(),
    blocked: z.boolean(),
  }).optional(),
});

export async function getValidationReopenImpact(
  cycleId: string,
): Promise<ValidationReopenImpact> {
  const res = await fetch(
    `/api/admin/cycles/${encodeURIComponent(cycleId)}/validation-reopen-impact`,
    { headers: buildHeaders() },
  );
  const body = await parseJson(res, validationReopenImpactSchema);
  if (!res.ok || !body.impact) {
    throw new Error(formatError(body, "Falha ao verificar o impacto da reabertura."));
  }
  return body.impact;
}

export async function transitionAdminCycle(
  cycleId: string,
  to: string,
  reopen?: { reason: string; responseDeadlineAt: string },
  validationReopen?: { reason: string },
): Promise<{
  cycle: { id: string; from?: string; to: string };
  closed?: boolean;
  report?: {
    status: ReportLifecycleStatus;
    reportId: string | null;
    emissionVersion: number | null;
    message: string | null;
  } | null;
}> {
  const res = await fetch(`/api/admin/cycles/${cycleId}/transition`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      to,
      reopenReason: reopen?.reason,
      reopenResponseDeadlineAt: reopen?.responseDeadlineAt,
      validationReopenReason: validationReopen?.reason,
    }),
  });
  const body = await parseJson(res, transitionResponseSchema);
  if (!res.ok || !body.cycle) throw new Error(formatError(body));
  return { cycle: body.cycle, closed: body.closed, report: body.report };
}

export async function consolidateAdminCycleValidation(
  cycleId: string,
): Promise<{ cycle: { id: string; from?: string; to: string } }> {
  const res = await fetch(`/api/admin/cycles/${cycleId}/validation/consolidate`, {
    method: "POST", headers: buildHeaders(),
  });
  const body = await parseJson(res, transitionResponseSchema);
  if (!res.ok || !body.cycle) throw new Error(formatError(body));
  return { cycle: body.cycle };
}

export async function updateAdminCycleSchedule(
  cycleId: string,
  input: {
    startsAt?: string | null;
    responseDeadlineAt?: string | null;
    validationDeadlineAt?: string | null;
    cycleCloseAt?: string | null;
  },
): Promise<{
  id: string;
  startsAt: string | null;
  responseDeadlineAt: string | null;
  validationDeadlineAt: string | null;
  cycleCloseAt: string | null;
}> {
  const res = await fetch(`/api/admin/cycles/${cycleId}`, {
    method: "PATCH", headers: buildHeaders(), body: JSON.stringify(input),
  });
  const body = await parseJson(res, scheduleResponseSchema);
  if (!res.ok || !body.cycle) throw new Error(formatError(body));
  return body.cycle;
}

export type EvidenceValidationResult = z.infer<typeof evidenceValidationSchema>;
export type ValidationAnalysisDraftResult = z.infer<
  typeof validationAnalysisDraftSchema
>;

export async function saveValidationAnalysisDraftAction(
  cycleId: string,
  input: {
    targetKind:
      | "evidence"
      | "not_applicable"
      | "absent_proof"
      | "admin_not_applicable";
    evidenceId?: string | null;
    responseId?: string | null;
    action?: string | null;
    justification?: string | null;
    notes?: string | null;
    expectedRevision?: number | null;
  },
): Promise<ValidationAnalysisDraftResult> {
  const res = await fetch(
    `/api/admin/cycles/${encodeURIComponent(cycleId)}/validation/analysis-draft`,
    {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(input),
    },
  );
  const body = await parseJson(res, validationAnalysisDraftResponseSchema);
  if (!res.ok) throw new Error(formatError(body));
  return body as ValidationAnalysisDraftResult;
}

export async function validateEvidenceAction(
  cycleId: string,
  evidenceId: string,
  input: {
    action: "approve" | "invalidate" | "request_adjustment";
    justification?: string | null;
    expectedStatus: "pending" | "approved" | "invalidated" | "adjustment_requested";
    expectedValidatedAt: string | null;
  },
): Promise<EvidenceValidationResult> {
  const res = await fetch(`/api/admin/cycles/${cycleId}/validation/evidences/${evidenceId}`, {
    method: "POST", headers: buildHeaders(), body: JSON.stringify(input),
  });
  const body = await parseJson(res, evidenceValidationSchema);
  if (!res.ok) throw new Error(formatError(body));
  return body;
}

export async function dispatchAdminEvidenceAdjustments(cycleId: string): Promise<{ adjustmentCount: number }> {
  const res = await fetch(`/api/admin/cycles/${cycleId}/validation/adjustments/dispatch`, {
    method: "POST", headers: buildHeaders(),
  });
  const body = await parseJson(res, adjustmentDispatchSchema);
  if (!res.ok) throw new Error(formatError(body));
  return { adjustmentCount: body.adjustmentCount };
}

export type NaValidationResult = z.infer<typeof naValidationSchema>;

export async function validateNotApplicableAction(
  cycleId: string,
  responseId: string,
  input: {
    action: "approve" | "reject";
    rejectionReason?: string | null;
    expectedStatus: "pending" | "approved" | "rejected";
    expectedValidatedAt: string | null;
  },
): Promise<NaValidationResult> {
  const res = await fetch(`/api/admin/cycles/${cycleId}/validation/not-applicable/${responseId}`, {
    method: "POST", headers: buildHeaders(), body: JSON.stringify(input),
  });
  const body = await parseJson(res, naValidationSchema);
  if (!res.ok) throw new Error(formatError(body));
  return body;
}

export type AdminApplicabilityClientResult = z.infer<typeof adminApplicabilitySchema>;
export type AdminProofDecisionClientResult = z.infer<typeof adminProofDecisionSchema>;

export async function decideAdminProofAction(
  cycleId: string,
  responseId: string,
  input: {
    action: "validate_without_proof" | "request_proof" | "consider_insufficient";
    observation: string;
    expectedStatus?: AdminProofStatus | null;
    expectedDecidedAt?: string | null;
  },
): Promise<AdminProofDecisionClientResult> {
  const res = await fetch(`/api/admin/cycles/${cycleId}/validation/admin-proof-decision/${responseId}`, {
    method: "POST", headers: buildHeaders(), body: JSON.stringify(input),
  });
  const body = await parseJson(res, adminProofDecisionSchema);
  if (!res.ok) throw new Error(formatError(body));
  return body;
}

async function updateAdminApplicability(
  cycleId: string,
  responseId: string,
  action: "mark" | "revert",
  input: {
    justification: string;
    expectedAdminStatus?: "not_applicable" | null;
    expectedDecidedAt?: string | null;
  },
): Promise<AdminApplicabilityClientResult> {
  const res = await fetch(`/api/admin/cycles/${cycleId}/validation/admin-not-applicable/${responseId}`, {
    method: "POST", headers: buildHeaders(), body: JSON.stringify({ action, ...input }),
  });
  const body = await parseJson(res, adminApplicabilitySchema);
  if (!res.ok) throw new Error(formatError(body));
  return body;
}

export function markAdminNotApplicableAction(
  cycleId: string,
  responseId: string,
  input: { justification: string; expectedAdminStatus?: "not_applicable" | null; expectedDecidedAt?: string | null },
): Promise<AdminApplicabilityClientResult> {
  return updateAdminApplicability(cycleId, responseId, "mark", input);
}

export function revertAdminNotApplicableAction(
  cycleId: string,
  responseId: string,
  input: { justification: string; expectedAdminStatus?: "not_applicable" | null; expectedDecidedAt?: string | null },
): Promise<AdminApplicabilityClientResult> {
  return updateAdminApplicability(cycleId, responseId, "revert", input);
}

export type ValidationBatchResult = { results: z.infer<typeof validationBatchItemSchema>[] };

export async function markAdminNotApplicableBatch(
  cycleId: string,
  input: { responseIds: string[]; justification: string },
): Promise<ValidationBatchResult> {
  const res = await fetch(`/api/admin/cycles/${cycleId}/validation/batch`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      kind: "admin_not_applicable",
      responseIds: input.responseIds,
      justification: input.justification,
    }),
  });
  const body = await parseJson(res, validationBatchSchema);
  if (!res.ok) throw new Error(formatError(body));
  return { results: body.results };
}

export async function validateQueueBatch(
  cycleId: string,
  input:
    | {
        kind: "evidence";
        items: Array<{
          id: string;
          status: "pending" | "approved" | "invalidated" | "adjustment_requested";
          validatedAt: string | null;
        }>;
        action: "approve" | "invalidate" | "request_adjustment";
        justification?: string | null;
      }
    | {
        kind: "not_applicable";
        items: Array<{
          id: string;
          status: "pending" | "approved" | "rejected";
          validatedAt: string | null;
        }>;
        action: "approve" | "reject";
        rejectionReason?: string | null;
      },
): Promise<ValidationBatchResult> {
  const res = await fetch(`/api/admin/cycles/${cycleId}/validation/batch`, {
    method: "POST", headers: buildHeaders(), body: JSON.stringify(input),
  });
  const body = await parseJson(res, validationBatchSchema);
  if (!res.ok) throw new Error(formatError(body));
  return { results: body.results };
}
