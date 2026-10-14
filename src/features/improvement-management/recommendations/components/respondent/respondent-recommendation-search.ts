import type { RespondentRecommendationItem } from "@/features/improvement-management/recommendations/respondent-presentation";

type SearchableDocument = {
  title: string;
  originalFilename?: string | null;
};

type SearchablePlan = {
  actionText: string;
  responsibleName: string;
  responsibleSector: string;
  observations?: string | null;
  documents?: readonly SearchableDocument[];
};

type SearchableRecommendation = Pick<
  RespondentRecommendationItem,
  "recommendationText" | "axisName" | "sectionName" | "formName" | "questionPrompt"
> & {
  plans: readonly SearchablePlan[];
};

/** Compara sem acento e sem diferença de maiúsculas, para "acao" achar "ação". */
export function foldSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Inclui o texto da ação, a área responsável e a comprovação, além da recomendação de origem. */
export function matchesRecommendationSearch(
  item: SearchableRecommendation,
  query: string,
  extra = "",
): boolean {
  const tokens = foldSearchText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return true;
  const actions = item.plans
    .map((plan) =>
      [
        plan.actionText,
        plan.responsibleName,
        plan.responsibleSector,
        plan.observations ?? "",
        ...(plan.documents ?? []).map(
          (document) => `${document.title} ${document.originalFilename ?? ""}`,
        ),
      ].join(" "),
    )
    .join(" ");
  const haystack = foldSearchText(
    [
      item.recommendationText,
      item.axisName,
      item.sectionName,
      item.formName,
      item.questionPrompt,
      actions,
      extra,
    ].join(" "),
  );
  return tokens.every((token) => haystack.includes(token));
}

/**
 * A URL só recebe a busca depois do debounce e sem espaços nas pontas.
 * Enquanto a pessoa ainda digita, o valor local precisa prevalecer sobre
 * essa versão atrasada — senão a próxima sincronização apaga letras.
 */
export function keepTypingSearch(
  typed: string,
  routeSearch: string,
  committedSearch: string,
): string {
  if (typed.trim() === routeSearch) return typed;
  if (typed.trim() !== committedSearch && routeSearch === committedSearch) return typed;
  return routeSearch;
}
