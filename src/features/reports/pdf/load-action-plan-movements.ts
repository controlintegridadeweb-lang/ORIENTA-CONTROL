import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { chunkValues } from "@/infrastructure/supabase/pagination";
import type { ReportActionMovementSource } from "@/features/reports/pdf/report-types";

const progressUpdateRowSchema = z.object({
  id: z.string().min(1),
  action_plan_id: z.string().min(1),
  previous_percentage: z.number().int().min(0).max(100),
  new_percentage: z.number().int().min(0).max(100),
  description: z.string().nullable(),
  created_at: z.string(),
  created_by: z.string().min(1),
});

/**
 * Carrega movimentações de progresso das ações do relatório, em ordem cronológica
 * crescente, sem duplicar registros.
 */
export async function loadActionPlanMovementsByActionId(
  supabase: SupabaseClient,
  actionPlanIds: string[],
): Promise<Record<string, ReportActionMovementSource[]>> {
  const uniqueIds = [...new Set(actionPlanIds.filter(Boolean))];
  const empty: Record<string, ReportActionMovementSource[]> = {};
  if (uniqueIds.length === 0) return empty;

  const rows: z.infer<typeof progressUpdateRowSchema>[] = [];
  for (const chunk of chunkValues(uniqueIds, 100)) {
    const { data, error } = await supabase
      .from("action_plan_progress_updates")
      .select(
        "id, action_plan_id, previous_percentage, new_percentage, description, created_at, created_by",
      )
      .in("action_plan_id", chunk)
      .order("created_at", { ascending: true });
    if (error) throw error;
    rows.push(...z.array(progressUpdateRowSchema).parse(data ?? []));
  }

  const actorIds = [...new Set(rows.map((row) => row.created_by))];
  const nameByUserId = new Map<string, string>();
  for (const chunk of chunkValues(actorIds, 100)) {
    if (chunk.length === 0) continue;
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", chunk);
    if (error) throw error;
    for (const profile of data ?? []) {
      const userId = String(profile.user_id ?? "");
      if (!userId) continue;
      const fullName = String(profile.full_name ?? "").trim();
      nameByUserId.set(userId, fullName || "Responsável não informado");
    }
  }

  const byAction: Record<string, ReportActionMovementSource[]> = {};
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const list = byAction[row.action_plan_id] ?? [];
    list.push({
      id: row.id,
      actionPlanId: row.action_plan_id,
      previousPercentage: row.previous_percentage,
      newPercentage: row.new_percentage,
      description: row.description,
      createdAt: row.created_at,
      responsibleLabel: nameByUserId.get(row.created_by) ?? "Responsável não informado",
    });
    byAction[row.action_plan_id] = list;
  }
  return byAction;
}
