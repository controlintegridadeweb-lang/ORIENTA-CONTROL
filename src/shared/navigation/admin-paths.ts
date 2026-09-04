import { parseUuidParam } from "@/shared/validation/uuid";
import type { SectionActionWorkspaceTab } from "./section-action-workspace";

export type AdminPlanoAcaoDetailSection = "visao-geral" | "acoes" | "monitoramento";

const ADMIN_BASE_PATH = "/admin";

/** Página completa do plano de integridade e compliance (workspace de supervisão). */
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

export type AdminSectionActionWorkspaceTab = SectionActionWorkspaceTab;

export function adminSectionActionWorkspaceHref(
  sectionId: string,
  cycleId: string,
  tab: AdminSectionActionWorkspaceTab = "visao-geral",
): string {
  const safeSectionId = parseUuidParam(sectionId);
  const safeCycleId = parseUuidParam(cycleId);
  if (!safeSectionId || !safeCycleId) {
    throw new Error("sectionId/cycleId inválidos para o Plano de integridade e compliance da seção.");
  }
  const params = new URLSearchParams({ cycleId: safeCycleId });
  return `${ADMIN_BASE_PATH}/plano-acao/secao/${safeSectionId}/${tab}?${params.toString()}`;
}

/** Entrada canônica do plano da seção — nunca usa recomendação como substituto. */
export function adminSectionPlanEntryHref(
  sectionId: string,
  cycleId: string,
  fallbackPath: string,
): string {
  if (!parseUuidParam(sectionId) || !parseUuidParam(cycleId)) {
    return fallbackPath;
  }
  return adminSectionActionWorkspaceHref(sectionId, cycleId, "visao-geral");
}
