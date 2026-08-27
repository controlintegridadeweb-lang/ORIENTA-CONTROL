import "server-only";

import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";

export type PreliminaryCriterionRow = {
  processingId: string;
  questionVersionId: string;
  questionPrompt: string;
  recommendationId: string | null;
  officialPoints: number;
  pointsPossible: number;
  recoveredPoints: number;
  preliminaryPoints: number;
  criterionCompleted: boolean | null;
  activeActionCount: number;
  completedActionCount: number | null;
  methodologyVersion: string;
};

export async function listPreliminaryCriterionRows(
  client: TypedSupabaseClient,
  processingIds: string[],
): Promise<PreliminaryCriterionRow[]> {
  if (processingIds.length === 0) return [];
  const { data, error } = await client
    .from("fami_preliminary_criterion_results")
    .select(
      "preliminary_processing_id, question_version_id, recommendation_id, official_points, points_possible, recovered_points, preliminary_points, criterion_completed, active_action_count, completed_action_count, fami_preliminary_processings!inner(methodology_version), question_versions!inner(prompt)",
    )
    .in("preliminary_processing_id", processingIds);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const processing = Array.isArray(row.fami_preliminary_processings)
      ? row.fami_preliminary_processings[0]
      : row.fami_preliminary_processings;
    return {
      processingId: row.preliminary_processing_id,
      questionVersionId: row.question_version_id,
      questionPrompt: String(
        (Array.isArray(row.question_versions)
          ? row.question_versions[0]?.prompt
          : row.question_versions?.prompt) ?? "",
      ),
      recommendationId: row.recommendation_id,
      officialPoints: Number(row.official_points),
      pointsPossible: Number(row.points_possible),
      recoveredPoints: Number(row.recovered_points),
      preliminaryPoints: Number(row.preliminary_points),
      criterionCompleted: row.criterion_completed,
      activeActionCount: Number(row.active_action_count),
      completedActionCount:
        row.completed_action_count == null ? null : Number(row.completed_action_count),
      methodologyVersion: String(processing?.methodology_version ?? ""),
    };
  });
}
