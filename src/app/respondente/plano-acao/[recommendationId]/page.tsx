import { redirect } from "next/navigation";
import { firstSearchParam } from "@/features/admin/search-params";
import {
  RESPONDENT_ACTION_PLAN_LIST_PATH,
  respondentActionWorkspacePath,
} from "@/shared/navigation/respondent-portfolio-paths";
import { parseUuidParam } from "@/shared/validation/uuid";

type Props = {
  params: Promise<{ recommendationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Entrada sem aba → Visão geral (compreender antes de executar). */
export default async function RespondentePlanoAcaoDetailIndexPage({
  params,
  searchParams,
}: Props) {
  const { recommendationId: rawId } = await params;
  const sp = await searchParams;
  const recommendationId = parseUuidParam(rawId);
  if (!recommendationId) {
    redirect(RESPONDENT_ACTION_PLAN_LIST_PATH);
  }

  redirect(
    respondentActionWorkspacePath(recommendationId, "visao-geral", {
      returnTo: firstSearchParam(sp, "returnTo") ?? null,
    }),
  );
}
