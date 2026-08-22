import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { CycleState } from "@/shared/domain/types";

export type OperationalCycle = {
  id: string;
  formVersionId: string;
  organizationId: string;
  periodLabel: string;
  state: CycleState;
  reopenCount: number;
  startsAt: string | null;
  responseDeadlineAt: string | null;
  validationDeadlineAt: string | null;
  cycleCloseAt: string | null;
  deadlinePolicy: "flexible_audited";
  submittedLateAt: string | null;
  submissionDelaySeconds: number | null;
  submittedAt: string | null;
  validatedAt: string | null;
  closedAt: string | null;
  reopenedAt: string | null;
  responseCollectionPausedAt: string | null;
};

export type CycleOperationalScope = {
  cycle: OperationalCycle;
  formId: string;
};

const cycleStateSchema = z.enum([
  "draft",
  "in_response",
  "submitted",
  "in_validation",
  "awaiting_adjustment",
  "validated",
  "completed",
]);

const relatedFormSchema = z.object({ form_id: z.string() }).passthrough();

const cycleScopeRowSchema = z.object({
  id: z.string(),
  form_version_id: z.string(),
  organization_id: z.string(),
  period_label: z.string(),
  state: cycleStateSchema,
  reopen_count: z.number().nullable(),
  starts_at: z.string().nullable(),
  response_deadline_at: z.string().nullable(),
  validation_deadline_at: z.string().nullable(),
  cycle_close_at: z.string().nullable(),
  deadline_policy: z.literal("flexible_audited"),
  submitted_late_at: z.string().nullable(),
  submission_delay_seconds: z.number().nullable(),
  submitted_at: z.string().nullable(),
  validated_at: z.string().nullable(),
  closed_at: z.string().nullable(),
  reopened_at: z.string().nullable(),
  response_collection_paused_at: z.string().nullable(),
  form_versions: z.union([relatedFormSchema, z.array(relatedFormSchema)]).nullable(),
}).passthrough();

type CycleScopeRow = z.infer<typeof cycleScopeRowSchema>;

const CYCLE_SCOPE_COLUMNS = [
  "id",
  "form_version_id",
  "organization_id",
  "period_label",
  "state",
  "reopen_count",
  "starts_at",
  "response_deadline_at",
  "validation_deadline_at",
  "cycle_close_at",
  "deadline_policy",
  "submitted_late_at",
  "submission_delay_seconds",
  "submitted_at",
  "validated_at",
  "closed_at",
  "reopened_at",
  "response_collection_paused_at",
  "form_versions!cycles_form_version_id_fkey!inner(form_id)",
].join(",");

function relatedFormId(row: CycleScopeRow): string | null {
  const relation = Array.isArray(row.form_versions)
    ? row.form_versions[0]
    : row.form_versions;
  return relation?.form_id ?? null;
}

function mapOperationalCycle(row: CycleScopeRow): OperationalCycle {
  return {
    id: row.id,
    formVersionId: row.form_version_id,
    organizationId: row.organization_id,
    periodLabel: row.period_label,
    state: row.state,
    reopenCount: row.reopen_count ?? 0,
    startsAt: row.starts_at,
    responseDeadlineAt: row.response_deadline_at,
    validationDeadlineAt: row.validation_deadline_at,
    cycleCloseAt: row.cycle_close_at,
    deadlinePolicy: row.deadline_policy,
    submittedLateAt: row.submitted_late_at,
    submissionDelaySeconds: row.submission_delay_seconds,
    submittedAt: row.submitted_at,
    validatedAt: row.validated_at,
    closedAt: row.closed_at,
    reopenedAt: row.reopened_at,
    responseCollectionPausedAt: row.response_collection_paused_at,
  };
}

/** Resolve ciclo e formulário em uma única leitura canônica. */
export async function resolveCycleOperationalScope(
  supabase: SupabaseClient,
  cycleId: string,
): Promise<CycleOperationalScope | null> {
  const { data, error } = await supabase
    .from("cycles")
    .select(CYCLE_SCOPE_COLUMNS)
    .eq("id", cycleId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = cycleScopeRowSchema.parse(data);
  const formId = relatedFormId(row);
  if (!formId) return null;
  return { cycle: mapOperationalCycle(row), formId };
}
