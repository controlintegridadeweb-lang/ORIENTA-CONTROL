import { redirect } from "next/navigation";
import { respondentRecommendationListPath } from "@/shared/navigation/respondent-navigation-context";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

/** Compatibilidade com links antigos: a lista agora pertence ao workspace único de recomendações. */
export default async function RespondentePlanoAcaoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  redirect(
    respondentRecommendationListPath("action-plan", {
      search: first(params.search),
      status: first(params.status),
      cycleId: first(params.cycleId),
      formId: first(params.formId),
      axisId: first(params.axisId),
      withPlan: "with",
      pendingOnly: first(params.pendingOnly) === "1",
      page: Number(first(params.page)) || undefined,
    }),
  );
}
