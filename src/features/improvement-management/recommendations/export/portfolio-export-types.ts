import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import type { RecommendationStatus } from "@/features/improvement-management/recommendations/schemas";

/** Cabeçalhos pt-BR na ordem de leitura do portfólio. */
export const RECOMMENDATION_PORTFOLIO_EXPORT_HEADERS = [
  "Formulário",
  "Versão",
  "Período",
  "Órgão",
  "Eixo",
  "Seção",
  "Pergunta de origem",
  "Recomendação",
  "Situação da recomendação",
  "Ação",
  "Responsável",
  "Início",
  "Final",
  "Situação da ação",
  "Progresso",
  "Última atualização",
] as const;

export type RecommendationPortfolioExportHeader =
  (typeof RECOMMENDATION_PORTFOLIO_EXPORT_HEADERS)[number];

/**
 * Fonte tipada para a exportação — composição dos dados já carregados
 * (recomendação + planos embutidos). Sem consultas adicionais.
 */
export type RecommendationPortfolioExportSource = {
  recommendationId: string;
  formName: string;
  formVersion: number;
  periodLabel: string;
  organizationName: string;
  axisName: string;
  sectionName: string;
  sectionOrder: number;
  questionOrder: number;
  questionPrompt: string;
  recommendationText: string;
  recommendationStatus: RecommendationStatus;
  plans: ActionPlanAction[];
};

/**
 * Linha tabular tipada do portfólio.
 * Sem ações → 1 linha com execução nula.
 * Com N ações → N linhas (contexto repetido).
 */
export type RecommendationPortfolioExportRow = {
  formName: string;
  formVersion: string | null;
  period: string;
  organizationName: string;
  axisName: string;
  sectionName: string;
  questionText: string;
  recommendationText: string;
  recommendationStatus: string;
  actionTitle: string | null;
  responsibleName: string | null;
  startDate: Date | null;
  endDate: Date | null;
  actionStatus: string | null;
  /** Fração 0–1 para XLSX; null sem ação. */
  progress: number | null;
  /** Percentual inteiro 0–100 para CSV/PDF; null sem ação. */
  progressPercent: number | null;
  updatedAt: Date | null;
  sort: {
    recommendationId: string;
    sectionOrder: number;
    questionOrder: number;
    actionOrder: number;
    actionId: string | null;
  };
};

export type RecommendationPortfolioExportFormat = "csv" | "xlsx" | "pdf";

/** Valor ausente canônico na apresentação do portfólio (PDF e ViewModel). */
export const PORTFOLIO_EXPORT_MISSING_VALUE = "—";

export type RecommendationPortfolioExportActionView = {
  title: string;
  responsible: string;
  startDate: string;
  endDate: string;
  status: string;
  progress: string;
  updatedAt: string;
};

export type RecommendationPortfolioExportRecommendationView = {
  questionText: string;
  recommendationText: string;
  recommendationStatus: string;
  actions: RecommendationPortfolioExportActionView[];
};

export type RecommendationPortfolioExportSectionView = {
  sectionName: string;
  sectionDisplayNumber: number;
  recommendations: RecommendationPortfolioExportRecommendationView[];
};

export type RecommendationPortfolioExportAxisView = {
  axisName: string;
  sections: RecommendationPortfolioExportSectionView[];
};

export type RecommendationPortfolioExportContextView = {
  formName: string;
  formVersion: string | null;
  period: string;
  organizationName: string;
  axes: RecommendationPortfolioExportAxisView[];
};

/**
 * ViewModel hierárquico da exportação:
 * Formulário/Órgão → Eixo → Seção → Recomendação → Ações.
 * Montado a partir das linhas tabulares já rotuladas e ordenadas.
 */
export type RecommendationPortfolioExportDocument = {
  contexts: RecommendationPortfolioExportContextView[];
};
