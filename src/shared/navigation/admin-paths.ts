export type AdminPlanoAcaoDetailSection = "visao-geral" | "acoes" | "monitoramento";

const ADMIN_BASE_PATH = "/admin";

/** Página completa do plano de ação (workspace de supervisão). */
export function adminPlanoAcaoDetailHref(
  recommendationId: string,
  section: AdminPlanoAcaoDetailSection = "visao-geral",
): string {
  return `${ADMIN_BASE_PATH}/plano-acao/${recommendationId}/${section}`;
}

/** Atalho para o detalhe do plano — abre na Visão geral por padrão. */
export function adminPlanoAcaoHref(recommendationId: string): string {
  return adminPlanoAcaoDetailHref(recommendationId, "visao-geral");
}

export function adminRecomendacoesHref(recommendationId: string): string {
  return `${ADMIN_BASE_PATH}/recomendacoes/${recommendationId}/visao-geral`;
}

export type AdminSectionActionWorkspaceTab = "visao-geral" | "acoes" | "monitoramento";

export function adminSectionActionWorkspaceHref(
  sectionId: string,
  cycleId: string,
  tab: AdminSectionActionWorkspaceTab = "visao-geral",
): string {
  const params = new URLSearchParams({ cycleId });
  return `${ADMIN_BASE_PATH}/plano-acao/secao/${sectionId}/${tab}?${params.toString()}`;
}
