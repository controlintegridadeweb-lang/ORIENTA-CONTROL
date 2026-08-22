import { redirect } from "next/navigation";
import { firstSearchParam } from "@/features/admin/search-params";
import { adminPlanoAcaoDetailHref } from "@/shared/navigation/admin-paths";
import { withAdminReturnPath } from "@/shared/navigation/admin-navigation-context";
import { parseUuidParam } from "@/shared/validation/uuid";

type Props = {
  params: Promise<{ recommendationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPlanoAcaoDetailIndexPage({ params, searchParams }: Props) {
  const { recommendationId: rawId } = await params;
  const sp = await searchParams;
  const recommendationId = parseUuidParam(rawId);
  if (!recommendationId) {
    redirect("/admin/plano-acao");
  }

  redirect(
    withAdminReturnPath(
      adminPlanoAcaoDetailHref(recommendationId, "visao-geral"),
      firstSearchParam(sp, "returnTo"),
    ),
  );
}
