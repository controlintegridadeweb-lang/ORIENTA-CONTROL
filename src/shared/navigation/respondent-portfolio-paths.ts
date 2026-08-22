import {
  respondentCycleReturnPathOrFallback,
  withRespondentReturnPath,
} from "./respondent-navigation-context";
import { parseUuidParam } from "@/shared/validation/uuid";

/** Portfólio de recomendações do respondente. */
export const RESPONDENT_RECOMMENDATIONS_PORTFOLIO_LABEL = "Recomendações";

/** Área operacional de ações vinculadas às recomendações. */
export const RESPONDENT_ACTION_PLAN_MODULE_LABEL = "Plano de ação";

/**
 * Tela canônica exibida depois que o servidor confirma o envio.
 * O retorno de origem é higienizado antes de entrar na URL para impedir que a
 * página de confirmação seja usada como redirecionamento aberto.
 */
export function respondentSubmissionConfirmationPath(
  cycleId: string,
  returnTo?: string | null,
  options: { submissionKind?: "diagnostic" | "corrections" } = {},
): string {
  const safeReturn = respondentCycleReturnPathOrFallback(returnTo);
  const params = new URLSearchParams({ returnTo: safeReturn });
  if (options.submissionKind === "corrections") {
    params.set("submission", "corrections");
  }
  return `/respondente/ciclos/${encodeURIComponent(cycleId)}/enviado?${params.toString()}`;
}

/** Workspace operacional (abas Visão geral, Ações, Monitoramento). */
const RESPONDENT_ACTION_WORKSPACE_BASE = "/respondente/plano-acao";

export type RespondentActionWorkspaceTab = "visao-geral" | "acoes" | "monitoramento";

export function respondentActionWorkspacePath(
  recommendationId: string,
  tab: RespondentActionWorkspaceTab = "visao-geral",
  options?: { returnTo?: string | null },
): string {
  const safeRecommendationId = parseUuidParam(recommendationId);
  if (!safeRecommendationId) {
    throw new Error("recommendationId inválido para o workspace do Plano de ação.");
  }
  return withRespondentReturnPath(
    `${RESPONDENT_ACTION_WORKSPACE_BASE}/${encodeURIComponent(safeRecommendationId)}/${tab}`,
    options?.returnTo,
  );
}

export type RespondentSectionActionWorkspaceTab = "visao-geral" | "acoes" | "monitoramento";

export function respondentSectionActionWorkspacePath(
  sectionId: string,
  cycleId: string,
  tab: RespondentSectionActionWorkspaceTab = "visao-geral",
  options?: { returnTo?: string | null },
): string {
  const safeSectionId = parseUuidParam(sectionId);
  const safeCycleId = parseUuidParam(cycleId);
  if (!safeSectionId || !safeCycleId) {
    throw new Error("sectionId/cycleId inválidos para o Plano de ação da seção.");
  }
  const path = `${RESPONDENT_ACTION_WORKSPACE_BASE}/secao/${encodeURIComponent(safeSectionId)}/${tab}?cycleId=${encodeURIComponent(safeCycleId)}`;
  return withRespondentReturnPath(path, options?.returnTo);
}
