import type { EvidenceListItem } from "./types";

type Scope = {
  questionId: string;
};

/** Evidências da recomendação, vinculadas pelo identificador canônico da questão. */
export function evidencesForRecommendationScope(
  items: EvidenceListItem[],
  scope: Scope,
): EvidenceListItem[] {
  return items.filter((e) => e.questionId === scope.questionId);
}
