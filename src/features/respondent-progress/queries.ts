import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { brtYearUtcBounds } from "@/features/fami";
import { listAssignedFormIdsForOrganization } from "@/features/forms/server";
import { collectSubmissionSnapshots, listCycles } from "@/features/cycles/server";
import {
  evaluateSubmissionProgress,
  type SubmissionQuestion,
} from "@/shared/domain/submission";
import { shouldShowFormOnRespondentDashboardForYear } from "./respondent-form-year-scope";
import type { RespondentProgress, RespondentProgressPeriod } from "./contracts";


const RESPONDENT_VISIBLE_FORM_STATES = [
  "in_response",
  "submitted",
  "in_validation",
  "awaiting_adjustment",
  "validated",
  "completed",
] as const;

export async function respondentProgress(
  organizationId: string,
  period?: RespondentProgressPeriod,
): Promise<RespondentProgress[]> {
  const client = createSupabaseServiceRoleClient();
  const periodBounds = period ? brtYearUtcBounds(period.year) : null;
  const assignedFormIds = new Set(
    await listAssignedFormIdsForOrganization(organizationId),
  );
  const cycles = (
    await listCycles(client, {
      organizationId,
      states: [...RESPONDENT_VISIBLE_FORM_STATES],
    })
  ).filter((cycle) => assignedFormIds.has(cycle.formId));
  if (cycles.length === 0) return [];

  const formIds = [...new Set(cycles.map((cycle) => cycle.formId))];
  const [{ data: forms, error: formsError }, snapshots] = await Promise.all([
    client.from("forms").select("id,created_at").in("id", formIds),
    collectSubmissionSnapshots(
      client,
      cycles.map((cycle) => ({
        cycleId: cycle.id,
        formVersionId: cycle.formVersionId,
        organizationId: cycle.organizationId,
      })),
    ),
  ]);
  if (formsError) throw formsError;

  const formCreatedAtById = new Map(
    (forms ?? []).map((form) => [
      form.id as string,
      (form.created_at as string) ?? new Date(0).toISOString(),
    ]),
  );
  const results: RespondentProgress[] = [];

  for (const cycle of cycles) {
    const snapshot = snapshots.get(cycle.id);
    const responses = snapshot?.responses ?? [];
    const evidences = snapshot?.evidences ?? [];
    const questions = snapshot?.questions ?? [];
    const submission = evaluateSubmissionProgress(questions, {
      requireResolvedAdjustments: cycle.state === "awaiting_adjustment",
    });
    const adjustments = questions.reduce(
      (totals: { requested: number; resolved: number }, question: SubmissionQuestion) => ({
        requested:
          totals.requested +
          (question.adjustmentRequestCount ??
            (question.validationStatus === "adjustment_requested" ||
            question.proofRequested
              ? 1
              : 0)),
        resolved:
          totals.resolved +
          (question.resolvedAdjustmentRequestCount ??
            (question.hasResolvedAllAdjustments ? 1 : 0)),
      }),
      { requested: 0, resolved: 0 },
    );

    const responsesInPeriod = periodBounds
      ? responses.filter(
          (response) =>
            response.updated_at >= periodBounds.fromInclusive &&
            response.updated_at <= periodBounds.toInclusive,
        ).length
      : responses.length;
    const validationsInPeriod = evidences.filter((evidence) => {
      if (!evidence.validated_at) return false;
      return !periodBounds || (
        evidence.validated_at >= periodBounds.fromInclusive &&
        evidence.validated_at <= periodBounds.toInclusive
      );
    }).length;

    if (
      period &&
      !shouldShowFormOnRespondentDashboardForYear({
        periodYear: period.year,
        cyclePeriodLabel: cycle.periodLabel,
        responsesUpdatedInPeriod: responsesInPeriod,
        validationsInPeriod,
        totalResponsesEver: responses.length,
        formCreatedAtIso:
          formCreatedAtById.get(cycle.formId) ?? new Date(0).toISOString(),
      })
    ) {
      continue;
    }

    results.push({
      cycleId: cycle.id,
      formId: cycle.formId,
      formName: cycle.formName,
      periodLabel: cycle.periodLabel,
      formVersion: cycle.formVersion,
      organizationName: cycle.organizationName,
      state: cycle.state,
      totalQuestions: submission.totalEligible,
      answeredQuestions: submission.answeredEligible,
      submissionReady: submission.ready,
      submissionBlockCount: submission.blocks.length,
      complementationRequests:
        cycle.state === "awaiting_adjustment" ? adjustments.requested : 0,
      resolvedComplementationRequests:
        cycle.state === "awaiting_adjustment" ? adjustments.resolved : 0,
    });
  }
  return results;
}
