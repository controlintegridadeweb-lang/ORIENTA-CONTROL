import type { RecommendationPortfolioExportContextView } from "@/features/improvement-management/recommendations/export/portfolio-export-types";

export type IntegrityPlanTocOutlineEntry = {
  title: string;
  level: number;
};

/** Eixos e seções do documento, na ordem em que o PDF os desenha. */
export function integrityPlanTocOutline(
  contexts: readonly RecommendationPortfolioExportContextView[],
): IntegrityPlanTocOutlineEntry[] {
  const nested = contexts.length > 1;
  const entries: IntegrityPlanTocOutlineEntry[] = [];
  for (const context of contexts) {
    if (nested) entries.push({ title: context.formName, level: 0 });
    const axisLevel = nested ? 1 : 0;
    const sectionLevel = nested ? 2 : 1;
    for (const axis of context.axes) {
      entries.push({ title: `Eixo - ${axis.axisName}`, level: axisLevel });
      for (const section of axis.sections) {
        entries.push({
          title: `Seção ${section.sectionDisplayNumber} - ${section.sectionName}`,
          level: sectionLevel,
        });
      }
    }
  }
  return entries;
}
