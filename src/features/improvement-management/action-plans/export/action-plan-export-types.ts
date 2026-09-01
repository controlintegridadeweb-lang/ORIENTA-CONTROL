import type { RecommendationPortfolioExportDocument } from "@/features/improvement-management/recommendations/export/portfolio-export-types";
import type { RecommendationPortfolioExportRow } from "@/features/improvement-management/recommendations/export/portfolio-export-types";
import type { RecommendationPortfolioExportSource } from "@/features/improvement-management/recommendations/export/portfolio-export-types";

/** Cabeçalhos pt-BR na ordem guarda-chuva do plano de integridade e compliance (1 linha por ação). */
export const ACTION_PLAN_EXPORT_HEADERS = [
  "Formulário",
  "Órgão",
  "Eixo",
  "Seção",
  "Ação",
  "Responsável",
  "Início",
  "Final",
  "Situação da ação",
  "Progresso",
  "Pergunta de origem",
  "Recomendação de origem",
  "Situação da recomendação",
  "Última atualização",
] as const;

export type ActionPlanExportHeader = (typeof ACTION_PLAN_EXPORT_HEADERS)[number];

export type ActionPlanExportFormat = "xlsx" | "pdf";

/**
 * Camada única de dados da exportação do plano de integridade e compliance.
 * Excel e PDF consomem a mesma estrutura; só a apresentação muda.
 */
export type ActionPlanExportData = {
  sources: readonly RecommendationPortfolioExportSource[];
  rows: RecommendationPortfolioExportRow[];
  document: RecommendationPortfolioExportDocument;
  issuedOn: string;
};
