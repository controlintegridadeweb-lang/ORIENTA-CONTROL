/** Links das filas operacionais administrativas com escopo opcional. */
import { adminPlanoAcaoDetailHref } from "@/shared/navigation/admin-paths";

export type AdminQueueSegment =
  | "evidencias"
  | "recomendacoes"
  | "plano-acao"
  | "formularios"
  | "maturidade";

export function adminQueueSegmentHref(
  segment: AdminQueueSegment,
  opts: { globalView: boolean; organizationId: string },
  params: Record<string, string>,
): string {
  const search = new URLSearchParams();
  if (!opts.globalView && opts.organizationId) {
    search.set("organizationId", opts.organizationId);
  }
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const path = `/admin/${segment}`;
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

/** Deep link para supervisão de recomendação sem plano no dashboard. */
export function adminPlanPendencyHref(recommendationId: string): string {
  return adminPlanoAcaoDetailHref(recommendationId, "visao-geral");
}
