"use client";

import Link from "next/link";
import { ArrowRight, FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { IllustratedPageHero } from "@/shared/ui/components/illustrated-page-hero";
import { RefreshActionButton } from "@/shared/ui/components/refresh-action-button";
import {
  RESPONDENT_ACTION_PLAN_LIST_TAB_LABEL,
  RESPONDENT_RECOMMENDATIONS_PORTFOLIO_LABEL,
} from "@/shared/navigation/respondent-portfolio-paths";
import { formSurface } from "@/shared/layout/form-surface";
import type { RespondentRecommendationListView } from "@/shared/navigation/respondent-navigation-context";
import type { RecommendationPortfolioExportFormat } from "@/features/improvement-management/recommendations/export/portfolio-export-types";
import { ExportMenu, type ExportMenuOption } from "@/shared/ui/components/export-menu";

const HERO_IMAGE = "/assets/respondent-recommendations-hero.png";

type Props = {
  view?: RespondentRecommendationListView;
  onRefresh: () => void;
  refreshing: boolean;
  onExport?: (format: RecommendationPortfolioExportFormat) => Promise<void>;
  exportDisabled?: boolean;
};

const HERO_COPY = {
  analysis: {
    overline: "Análise institucional",
    title: RESPONDENT_RECOMMENDATIONS_PORTFOLIO_LABEL,
    description: "Consulte as análises geradas após a validação e identifique o que precisa ser tratado.",
    ctaHref: "/respondente/portfolio-recomendacoes?status=generated&pendingOnly=1",
    ctaLabel: "Ver pendentes",
  },
  "action-plan": {
    overline: "Execução e acompanhamento",
    title: RESPONDENT_ACTION_PLAN_LIST_TAB_LABEL,
    description: "Acompanhe ações, responsáveis, início, final e progresso dos planos já criados.",
    // Pendentes sem plano ficam na aba de recomendações (analysis).
    ctaHref: "/respondente/portfolio-recomendacoes?status=generated&pendingOnly=1",
    ctaLabel: "Ver recomendações pendentes",
  },
} as const;

const PORTFOLIO_EXPORT_OPTIONS: Array<ExportMenuOption<RecommendationPortfolioExportFormat>> = [
  {
    format: "csv",
    label: "Exportar CSV",
    icon: Table2,
    hint: "Tabela com uma linha por ação, compatível com Excel pt-BR.",
  },
  {
    format: "xlsx",
    label: "Exportar Excel",
    icon: FileSpreadsheet,
    hint: "Planilha com filtros, datas e progresso formatados.",
  },
  {
    format: "pdf",
    label: "Exportar PDF",
    icon: FileText,
    hint: "Relatório agrupado por formulário, eixo e seção.",
  },
];

const ACTION_PLAN_EXPORT_OPTIONS: Array<ExportMenuOption<"xlsx" | "pdf">> = [
  {
    format: "xlsx",
    label: "Exportar Excel",
    icon: FileSpreadsheet,
    hint: "Planilha analítica com uma linha por ação, filtros e datas reais.",
  },
  {
    format: "pdf",
    label: "Exportar PDF",
    icon: FileText,
    hint: "Relatório bimestral de acompanhamento do plano de integridade e compliance.",
  },
];

export function RespondentRecommendationsHero({
  view = "analysis",
  onRefresh,
  refreshing,
  onExport,
  exportDisabled,
}: Props) {
  const copy = HERO_COPY[view];

  return (
    <IllustratedPageHero
      theme="respondent"
      size="compact"
      ariaLabel={copy.title}
      overline={copy.overline}
      title={copy.title}
      description={copy.description}
      image={HERO_IMAGE}
      priority
      actions={
        <>
          <RefreshActionButton onRefresh={onRefresh} refreshing={refreshing} />
          {onExport && view === "action-plan" ? (
            <ExportMenu
              options={ACTION_PLAN_EXPORT_OPTIONS}
              onExport={onExport}
              disabled={exportDisabled || refreshing}
            />
          ) : onExport ? (
            <ExportMenu
              options={PORTFOLIO_EXPORT_OPTIONS}
              onExport={onExport}
              disabled={exportDisabled || refreshing}
            />
          ) : null}
          <Link href={copy.ctaHref} className={formSurface.primaryButtonSm}>
            {copy.ctaLabel}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </>
      }
    />
  );
}
