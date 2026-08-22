import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { QueueProgress } from "../queue-model";

const progressSummarySchema = z.object({
  evidence: z.object({
    total: z.number().int(),
    pending: z.number().int(),
    approved: z.number().int(),
    invalid: z.number().int(),
    adjustmentRequested: z.number().int(),
    notPresented: z.number().int().default(0),
    validatedWithoutProof: z.number().int().default(0),
    proofRequested: z.number().int().default(0),
  }),
  notApplicable: z.object({
    total: z.number().int(),
    pending: z.number().int(),
    approved: z.number().int(),
    rejected: z.number().int(),
  }),
  finalization: z.object({
    ready: z.boolean(),
    blockers: z.object({
      pendingEvidence: z.number().int().nonnegative(),
      pendingNotApplicable: z.number().int().nonnegative(),
      undecidedAbsentProof: z.number().int().nonnegative(),
      incompleteResponses: z.number().int().nonnegative(),
      missingRecommendations: z.number().int().nonnegative(),
      missingWorkingProcessing: z.boolean(),
    }),
  }).optional(),
});

type ProgressSummary = z.infer<typeof progressSummarySchema>;

function toQueueProgress(summary: ProgressSummary): QueueProgress {
  const evidence = summary.evidence;
  const notApplicable = summary.notApplicable;
  const evidenceEvaluated =
    evidence.approved +
    evidence.invalid +
    evidence.adjustmentRequested +
    evidence.validatedWithoutProof +
    evidence.proofRequested;
  const notApplicableEvaluated =
    notApplicable.approved + notApplicable.rejected;
  const total = evidence.total + notApplicable.total;
  const evaluated = evidenceEvaluated + notApplicableEvaluated;

  return {
    total,
    pending: evidence.pending,
    approved: evidence.approved,
    invalid: evidence.invalid,
    adjustmentRequested: evidence.adjustmentRequested,
    validatedWithoutProof: evidence.validatedWithoutProof,
    proofRequested: evidence.proofRequested,
    notPresented: evidence.notPresented,
    naTotal: notApplicable.total,
    naPending: notApplicable.pending,
    naApproved: notApplicable.approved,
    naRejected: notApplicable.rejected,
    evaluatedRatio: total === 0 ? 1 : evaluated / total,
    readyToConsolidate:
      summary.finalization?.ready ??
      (evidence.pending === 0 &&
        evidence.adjustmentRequested === 0 &&
        evidence.notPresented === 0 &&
        evidence.proofRequested === 0 &&
        notApplicable.pending === 0),
  };
}

export async function loadValidationQueueProgress(
  supabase: SupabaseClient,
  cycleId: string,
): Promise<QueueProgress> {
  const { data, error } = await supabase.rpc("get_validation_queue_summary", {
    p_cycle_id: cycleId,
  });
  if (error) throw error;
  return toQueueProgress(progressSummarySchema.parse(data));
}

export async function cycleHasValidationReopen(
  supabase: SupabaseClient,
  cycleId: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from("cycle_validation_reopen_events")
    .select("id", { count: "exact", head: true })
    .eq("cycle_id", cycleId);
  if (error) throw error;
  return (count ?? 0) > 0;
}
