import { parseUuidParam } from "@/shared/validation/uuid";

/** Aba de recomendações dentro do workspace unificado do respondente. */
export const RESPONDENT_RECOMMENDATIONS_PORTFOLIO_LABEL = "Recomendações";

/** Aba do plano dentro do workspace unificado do respondente. */
export const RESPONDENT_ACTION_PLAN_LIST_TAB_LABEL = "Plano de integridade e compliance";

/**
 * Contexto de retorno entre a aba de recomendações e a aba do plano de integridade e compliance.
 *
 * A lista usa um único workspace com duas visões. O caminho legado de
 * `/respondente/plano-acao` continua aceito apenas para redirecionamentos e retornos já salvos.
 */
export type RespondentRecommendationListView = "analysis" | "action-plan";

export type RespondentRecommendationListFilter = {
  search: string;
  status: string;
  cycleId: string;
  formId: string;
  axisId: string;
  withPlan: "all" | "with" | "without";
  pendingOnly: boolean;
  page?: number;
};

const RESPONDENT_RECOMMENDATIONS_PATH = "/respondente/portfolio-recomendacoes";
const RESPONDENT_ACTION_PLAN_LEGACY_PATH = "/respondente/plano-acao";
const RESPONDENT_FORMS_PATH = "/respondente/formularios";
const RESPONDENT_EVIDENCES_PATH = "/respondente/evidencias";

const RECOMMENDATION_RETURN_PARAM_LIMITS = {
  search: 200,
  status: 40,
  cycleId: 100,
  formId: 100,
  axisId: 100,
  withPlan: 20,
} as const;

function setIfPresent(params: URLSearchParams, key: string, value: string): void {
  if (value.trim()) params.set(key, value.trim());
}

export function respondentRecommendationView(
  params: Pick<URLSearchParams, "get">,
): RespondentRecommendationListView {
  return params.get("view") === "action-plan" ? "action-plan" : "analysis";
}

/** Caminho canônico da lista com os filtros ativos. */
export function respondentRecommendationListPath(
  view: RespondentRecommendationListView,
  filter: RespondentRecommendationListFilter,
): string {
  const params = new URLSearchParams();
  if (view === "action-plan") params.set("view", "action-plan");
  setIfPresent(params, "search", filter.search);
  setIfPresent(params, "status", filter.status);
  setIfPresent(params, "cycleId", filter.cycleId);
  setIfPresent(params, "formId", filter.formId);
  setIfPresent(params, "axisId", filter.axisId);
  if (filter.pendingOnly) params.set("pendingOnly", "1");
  if (view === "analysis" && filter.withPlan !== "all") {
    params.set("withPlan", filter.withPlan);
  }
  if (filter.page != null && Number.isInteger(filter.page) && filter.page > 1) {
    params.set("page", String(filter.page));
  }

  const query = params.toString();
  return query ? `${RESPONDENT_RECOMMENDATIONS_PATH}?${query}` : RESPONDENT_RECOMMENDATIONS_PATH;
}

/** Adiciona um retorno interno e validável ao workspace de uma recomendação. */
export function withRespondentReturnPath(path: string, returnTo?: string | null): string {
  if (!returnTo || !isSafeRespondentListPath(returnTo)) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}

/** Só permite retornar às listas oficiais, sem aceitar detalhes arbitrários ou URL externa. */
export function isSafeRespondentListPath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  try {
    const url = new URL(value, "http://orienta.local");
    if (url.origin !== "http://orienta.local") return false;
    if (
      url.pathname === RESPONDENT_RECOMMENDATIONS_PATH ||
      url.pathname === RESPONDENT_ACTION_PLAN_LEGACY_PATH
    ) {
      return true;
    }
    const sectionWorkspace = /^\/respondente\/plano-acao\/secao\/([^/]+)\/(visao-geral|acoes|monitoramento)$/i.exec(url.pathname);
    return Boolean(
      sectionWorkspace &&
      parseUuidParam(sectionWorkspace[1]) &&
      parseUuidParam(url.searchParams.get("cycleId")),
    );
  } catch {
    return false;
  }
}

export function respondentReturnPathOrFallback(
  value: string | null | undefined,
  fallback: string,
): string {
  return value && isSafeRespondentListPath(value) ? value : fallback;
}

export function respondentReturnLabel(returnPath: string): string {
  if (returnPath.startsWith(`${RESPONDENT_ACTION_PLAN_LEGACY_PATH}/secao/`)) {
    return "Voltar ao plano da seção";
  }
  if (
    returnPath === RESPONDENT_ACTION_PLAN_LEGACY_PATH ||
    returnPath.startsWith(`${RESPONDENT_ACTION_PLAN_LEGACY_PATH}?`)
  ) {
    return `Voltar ao ${RESPONDENT_ACTION_PLAN_LIST_TAB_LABEL}`;
  }
  try {
    const url = new URL(returnPath, "http://orienta.local");
    return url.searchParams.get("view") === "action-plan"
      ? `Voltar ao ${RESPONDENT_ACTION_PLAN_LIST_TAB_LABEL}`
      : `Voltar a ${RESPONDENT_RECOMMENDATIONS_PORTFOLIO_LABEL}`;
  } catch {
    return `Voltar a ${RESPONDENT_RECOMMENDATIONS_PORTFOLIO_LABEL}`;
  }
}

function sanitizeFormsReturnPath(url: URL): string {
  const params = new URLSearchParams();
  const year = url.searchParams.get("year");
  if (year && /^\d{4}$/.test(year)) params.set("year", year);
  const query = params.toString();
  return query ? `${RESPONDENT_FORMS_PATH}?${query}` : RESPONDENT_FORMS_PATH;
}

function sanitizeEvidenceReturnPath(url: URL): string {
  const params = new URLSearchParams();
  if (url.searchParams.get("view") === "all") params.set("view", "all");

  for (const key of ["cycleId", "formId", "status", "search"] as const) {
    const value = url.searchParams.get(key)?.trim();
    if (value) params.set(key, value.slice(0, key === "search" ? 200 : 100));
  }

  for (const key of ["axisName", "sectionName"] as const) {
    const value = url.searchParams.get(key)?.trim();
    if (value) params.set(key, value.slice(0, 200));
  }

  if (url.searchParams.get("pendingOnly") === "1") params.set("pendingOnly", "1");
  const offset = Number(url.searchParams.get("offset"));
  if (Number.isInteger(offset) && offset > 0) params.set("offset", String(offset));

  const query = params.toString();
  return query ? `${RESPONDENT_EVIDENCES_PATH}?${query}` : RESPONDENT_EVIDENCES_PATH;
}

function sanitizeRecommendationReturnPath(url: URL): string {
  const view: RespondentRecommendationListView =
    url.pathname === RESPONDENT_ACTION_PLAN_LEGACY_PATH ||
    url.searchParams.get("view") === "action-plan"
      ? "action-plan"
      : "analysis";
  const filter: RespondentRecommendationListFilter = {
    search: "",
    status: "",
    cycleId: "",
    formId: "",
    axisId: "",
    withPlan: view === "action-plan" ? "with" : "all",
    pendingOnly: false,
  };

  for (const [key, limit] of Object.entries(RECOMMENDATION_RETURN_PARAM_LIMITS)) {
    const value = url.searchParams.get(key)?.trim();
    if (value) {
      filter[key as keyof typeof RECOMMENDATION_RETURN_PARAM_LIMITS] = value.slice(0, limit) as never;
    }
  }
  if (filter.withPlan !== "with" && filter.withPlan !== "without") filter.withPlan = "all";
  if (view === "action-plan") filter.withPlan = "with";
  filter.pendingOnly = url.searchParams.get("pendingOnly") === "1";
  const page = Number(url.searchParams.get("page"));
  if (Number.isInteger(page) && page > 1) filter.page = page;
  return respondentRecommendationListPath(view, filter);
}

export function respondentRecommendationPage(params: Pick<URLSearchParams, "get">): number {
  const page = Number(params.get("page"));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** Retorno seguro do workspace de resposta para diagnósticos, evidências ou recomendações. */
export function respondentCycleReturnPathOrFallback(
  value: string | null | undefined,
  fallback = RESPONDENT_FORMS_PATH,
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, "http://orienta.local");
    if (url.origin !== "http://orienta.local") return fallback;
    if (url.pathname === RESPONDENT_FORMS_PATH) return sanitizeFormsReturnPath(url);
    if (url.pathname === RESPONDENT_EVIDENCES_PATH) return sanitizeEvidenceReturnPath(url);
    if (
      url.pathname === RESPONDENT_RECOMMENDATIONS_PATH ||
      url.pathname === RESPONDENT_ACTION_PLAN_LEGACY_PATH
    ) {
      return sanitizeRecommendationReturnPath(url);
    }
    return fallback;
  } catch {
    return fallback;
  }
}

/** Caminho seguro para o diagnóstico completo, preservando a lista de origem. */
export function respondentCyclePath(
  cycleId: string,
  returnTo?: string | null,
): string {
  const safeReturn = respondentCycleReturnPathOrFallback(returnTo, "");
  const basePath = `/respondente/ciclos/${encodeURIComponent(cycleId)}`;
  return safeReturn
    ? `${basePath}?returnTo=${encodeURIComponent(safeReturn)}`
    : basePath;
}

/** Deep link seguro para uma pergunta, preservando a lista de origem. */
export function respondentCycleQuestionPath(
  cycleId: string,
  questionId: string,
  returnTo?: string | null,
): string {
  const params = new URLSearchParams({ questionId });
  const safeReturn = respondentCycleReturnPathOrFallback(returnTo, "");
  if (safeReturn) params.set("returnTo", safeReturn);
  return `/respondente/ciclos/${encodeURIComponent(cycleId)}?${params.toString()}`;
}

export function respondentCycleReturnLabel(returnPath: string): string {
  if (returnPath === RESPONDENT_EVIDENCES_PATH || returnPath.startsWith(`${RESPONDENT_EVIDENCES_PATH}?`)) {
    return "Voltar às evidências";
  }
  if (
    returnPath === RESPONDENT_RECOMMENDATIONS_PATH ||
    returnPath.startsWith(`${RESPONDENT_RECOMMENDATIONS_PATH}?`) ||
    returnPath === RESPONDENT_ACTION_PLAN_LEGACY_PATH ||
    returnPath.startsWith(`${RESPONDENT_ACTION_PLAN_LEGACY_PATH}?`)
  ) {
    return respondentReturnLabel(returnPath);
  }
  return "Voltar para meus diagnósticos";
}
