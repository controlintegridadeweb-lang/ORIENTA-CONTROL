import "server-only";

import { loadFrozenFamiScopeCatalog } from "@/features/fami/frozen-scope-catalog";
import { sortAxesMaturity } from "@/features/fami";
import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";
import type {
  ReportFamiAxisScore,
  ReportFamiSectionScore,
} from "@/features/reports/pdf/report-types";

export async function loadPreliminaryFamiScopedScores(
  client: TypedSupabaseClient,
  processingId: string,
  cycleId: string,
): Promise<{ byAxis: ReportFamiAxisScore[]; sections: ReportFamiSectionScore[] }> {
  const { data, error } = await client
    .from("fami_preliminary_results")
    .select(
      "scope_type, scope_id, percentage, maturity_level, points_obtained, points_possible",
    )
    .eq("preliminary_processing_id", processingId)
    .in("scope_type", ["axis", "section"]);
  if (error) throw error;

  const rows = data ?? [];
  const axisRows = rows.filter((row) => row.scope_type === "axis" && row.scope_id);
  const sectionRows = rows.filter((row) => row.scope_type === "section" && row.scope_id);
  const catalog = await loadFrozenFamiScopeCatalog(client, cycleId);

  const sections: ReportFamiSectionScore[] = sectionRows
    .map((row) => {
      const sectionId = row.scope_id!;
      const frozen = catalog.sections.get(sectionId);
      return {
        sectionId,
        sectionName: frozen?.name ?? "Seção histórica sem identificação",
        axisId: frozen?.axisId ?? null,
        percentage: Number(row.percentage ?? 0),
        maturityLevel: row.maturity_level == null ? null : Number(row.maturity_level),
        pointsObtained: Number(row.points_obtained ?? 0),
        pointsPossible: Number(row.points_possible ?? 0),
        order: frozen?.order ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((a, b) => a.order - b.order || a.sectionName.localeCompare(b.sectionName, "pt-BR"))
    .map(({ order, ...section }) => ({
      ...section,
      sectionOrder: order,
    }));

  const byAxis: ReportFamiAxisScore[] = sortAxesMaturity(
    axisRows.map((row) => ({
      axisId: row.scope_id!,
      axisName: catalog.axes.get(row.scope_id!)?.name ?? "Eixo histórico sem identificação",
      percentage: Number(row.percentage ?? 0),
      maturityLevel: row.maturity_level == null ? null : Number(row.maturity_level),
    })),
  ).map((axis) => {
    const source = axisRows.find((row) => row.scope_id === axis.axisId);
    return {
      axisId: axis.axisId ?? null,
      axisName: axis.axisName,
      percentage: axis.percentage,
      maturityLevel: axis.maturityLevel,
      pointsObtained: Number(source?.points_obtained ?? 0),
      pointsPossible: Number(source?.points_possible ?? 0),
    };
  });

  return { byAxis, sections };
}
