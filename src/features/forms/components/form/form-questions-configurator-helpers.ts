import type { InlineMetric, QuestionLibraryConfiguration } from "@/features/library";
import type { LibraryAxis, LibrarySection } from "@/features/library";
import type { QuestionWaiverRow } from "@/features/forms/waiver-client";

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

export function sectionLabel(section: LibrarySection, axes: LibraryAxis[]): string {
  const axis = axes.find((a) => a.id === section.axisId);
  return `${axis?.name ?? section.axisCode} → ${section.name}`;
}
