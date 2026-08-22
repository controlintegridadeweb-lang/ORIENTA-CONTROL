import { redirect } from "next/navigation";
import { firstSearchParam } from "@/features/admin/search-params";
import { adminRecomendacoesHref } from "@/shared/navigation/admin-paths";
import { withAdminReturnPath } from "@/shared/navigation/admin-navigation-context";
import { parseUuidParam } from "@/shared/validation/uuid";

type Props = {
  params: Promise<{ recommendationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminRecomendacaoDetailIndexPage({ params, searchParams }: Props) {
  const { recommendationId: rawId } = await params;
  const sp = await searchParams;
  const recommendationId = parseUuidParam(rawId);
  if (!recommendationId) {
    redirect("/admin/recomendacoes");
  }

  redirect(
    withAdminReturnPath(adminRecomendacoesHref(recommendationId), firstSearchParam(sp, "returnTo")),
  );
}
