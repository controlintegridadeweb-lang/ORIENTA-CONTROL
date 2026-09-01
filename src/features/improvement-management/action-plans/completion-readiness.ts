import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { pickOne } from "@/features/improvement-management/action-plans/domain-model";
import { queryActionPlanRecommendationRows } from "./cycle-read-model";
import type { RecommendationRowRaw } from "./types";

import {
  ACTION_PLAN_COMPLETION_BLOCK_REASONS,
  emptyActionPlanCompletionCounts,
  type ActionPlanCompletionBlock,
  type ActionPlanCompletionBlockReason,
  type ActionPlanCompletionReadiness,
} from "./completion-readiness-model";

export {
  ACTION_PLAN_COMPLETION_BLOCK_REASONS,
  type ActionPlanCompletionBlock,
  type ActionPlanCompletionBlockReason,
  type ActionPlanCompletionReadiness,
} from "./completion-readiness-model";

type BlockerRow = {
  recommendation_id: string;
  action_plan_id: string | null;
  blocker: ActionPlanCompletionBlockReason;
};

const blockerRowSchema = z.object({
  recommendation_id: z.string().min(1),
  action_plan_id: z.string().min(1).nullable(),
  blocker: z.enum(ACTION_PLAN_COMPLETION_BLOCK_REASONS),
});

function actionLabel(row: RecommendationRowRaw | undefined, actionPlanId: string | null) {
  if (!row || !actionPlanId) return null;
  const plans = Array.isArray(row.action_plans)
    ? row.action_plans
    : row.action_plans
      ? [row.action_plans]
      : [];
  const plan = plans.find((item) => String(item.id) === actionPlanId);
  const text = String(plan?.action_text ?? "").trim();
  if (!text) return null;
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

/**
 * Converte os bloqueios calculados pelo banco em uma visão legível da UI.
 * A regra permanece centralizada em `cycle_action_plan_supervision_blockers`;
 * esta função apenas enriquece cada item com o critério e a ação correspondentes.
 */
export function evaluateActionPlanCompletionReadiness(
  blockers: BlockerRow[],
  recommendations: RecommendationRowRaw[],
): ActionPlanCompletionReadiness {
  const recommendationById = new Map(
    recommendations.map((recommendation) => [recommendation.id, recommendation]),
  );
  const countsByReason = emptyActionPlanCompletionCounts();

  const blocks = blockers.map<ActionPlanCompletionBlock>((blocker) => {
    const recommendation = recommendationById.get(blocker.recommendation_id);
    const question = recommendation ? pickOne(recommendation.questions) : null;
    countsByReason[blocker.blocker] += 1;
    return {
      recommendationId: blocker.recommendation_id,
      questionId: recommendation?.question_id ?? "",
      questionPrompt: question?.prompt ?? "Critério sem título",
      actionPlanId: blocker.action_plan_id,
      actionLabel: actionLabel(recommendation, blocker.action_plan_id),
      reason: blocker.blocker,
    };
  });

  return {
    ready: blocks.length === 0,
    pendingCount: blocks.length,
    blocks,
    countsByReason,
  };
}

export async function loadActionPlanCompletionReadiness(
  client: SupabaseClient,
  cycleId: string,
): Promise<ActionPlanCompletionReadiness> {
  const [recommendations, blockerResult] = await Promise.all([
    queryActionPlanRecommendationRows(client, { cycleId }),
    client.rpc("cycle_action_plan_supervision_blockers", { p_cycle_id: cycleId }),
  ]);
  if (blockerResult.error) throw blockerResult.error;
  const blockers = z.array(blockerRowSchema).parse(blockerResult.data ?? []);
  return evaluateActionPlanCompletionReadiness(blockers, recommendations);
}

export function filterActionPlanCompletionReadiness(
  readiness: ActionPlanCompletionReadiness,
  recommendationId: string,
): ActionPlanCompletionReadiness {
  const blocks = readiness.blocks.filter(
    (block) => block.recommendationId === recommendationId,
  );
  const countsByReason = emptyActionPlanCompletionCounts();
  for (const block of blocks) countsByReason[block.reason] += 1;
  return {
    ready: blocks.length === 0,
    pendingCount: blocks.length,
    blocks,
    countsByReason,
  };
}

export async function loadRecommendationActionPlanCompletionReadiness(
  client: SupabaseClient,
  recommendationId: string,
): Promise<ActionPlanCompletionReadiness> {
  const { data, error } = await client
    .from("recommendations")
    .select("cycle_id")
    .eq("id", recommendationId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.cycle_id) {
    throw new Error("Recomendação não encontrada ao verificar os bloqueios do plano de integridade e compliance.");
  }

  const readiness = await loadActionPlanCompletionReadiness(
    client,
    String(data.cycle_id),
  );
  return filterActionPlanCompletionReadiness(readiness, recommendationId);
}
