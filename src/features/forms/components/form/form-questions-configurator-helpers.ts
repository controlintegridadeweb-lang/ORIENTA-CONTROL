import type { InlineMetric, QuestionLibraryConfiguration } from "@/features/library";
import type { LibraryAxis, LibrarySection } from "@/features/library";
import type { QuestionWaiverRow } from "@/features/forms/waiver-client";
import { structuralAxisOrderIndex } from "@/shared/domain/axis";

export const RECOMMENDATION_TITLE_MAX = 500;
export const RECOMMENDATION_TEXT_MAX = 4000;

export type WaiversByQuestion = Map<string, Map<string, QuestionWaiverRow>>;

export function buildWaiversIndex(rows: QuestionWaiverRow[]): WaiversByQuestion {
  const index: WaiversByQuestion = new Map();
  for (const row of rows) {
    const byOrg = index.get(row.questionId) ?? new Map<string, QuestionWaiverRow>();
    byOrg.set(row.organizationId, row);
    index.set(row.questionId, byOrg);
  }
  return index;
}

export function defaultMetricForPrompt(prompt: string): InlineMetric {
  return {
    name: prompt.slice(0, 200) || "Pergunta",
    description: null,
    answerType: "yes_no",
    interpretation: "qualitative",
  };
}

export function createDefaultConfiguration(
  questionId: string,
  prompt: string,
  sectionId: string,
): QuestionLibraryConfiguration {
  return {
    questionId,
    sectionId,
    metric: defaultMetricForPrompt(prompt),
    bindings: {},
    responseMapping: {},
    coverageScore: 0,
    updatedBy: null,
    updatedAt: new Date().toISOString(),
  };
}

export type LibrarySectionAxisGroup = {
  axisId: string;
  axisName: string;
  sections: LibrarySection[];
};

/**
 * Agrupa seções na ordem institucional (Governança → Ambiental → Social)
 * e, dentro de cada eixo, por `ordem` e depois pelo nome.
 */
export function groupLibrarySectionsByAxis(
  sections: readonly LibrarySection[],
  axes: readonly LibraryAxis[],
): LibrarySectionAxisGroup[] {
  const axisById = new Map(axes.map((axis) => [axis.id, axis]));
  const sorted = [...sections].sort((a, b) => {
    const nameA = axisById.get(a.axisId)?.name ?? a.axisCode;
    const nameB = axisById.get(b.axisId)?.name ?? b.axisCode;
    const axisDiff = structuralAxisOrderIndex(nameA) - structuralAxisOrderIndex(nameB);
    if (axisDiff !== 0) return axisDiff;
    const axisNameDiff = nameA.localeCompare(nameB, "pt-BR");
    if (axisNameDiff !== 0) return axisNameDiff;
    const orderDiff = a.ordem - b.ordem;
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  const groups: LibrarySectionAxisGroup[] = [];
  const indexByAxisId = new Map<string, number>();
  for (const section of sorted) {
    const existing = indexByAxisId.get(section.axisId);
    if (existing != null) {
      groups[existing]?.sections.push(section);
      continue;
    }
    indexByAxisId.set(section.axisId, groups.length);
    groups.push({
      axisId: section.axisId,
      axisName: axisById.get(section.axisId)?.name ?? section.axisCode,
      sections: [section],
    });
  }
  return groups;
}
