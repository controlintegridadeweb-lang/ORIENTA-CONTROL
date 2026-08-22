"use client";

import { FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { AdminMonitoringHero } from "@/features/improvement-management/monitoring/components/admin-monitoring-hero";
import type { RecommendationPortfolioExportFormat } from "@/features/improvement-management/recommendations/export/portfolio-export-types";
import { ADMIN_RECOMENDACOES_HERO_IMAGE } from "@/shared/config/page-assets/admin-recommendations-hero-image";
import { ExportMenu, type ExportMenuOption } from "@/shared/ui/components/export-menu";

type Props = {
  loading?: boolean;
  onRefresh: () => void;
  onExport: (format: RecommendationPortfolioExportFormat) => Promise<void>;
};

const OPTIONS: Array<ExportMenuOption<RecommendationPortfolioExportFormat>> = [
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

export function AdminRecommendationsHero({
  loading,
  onRefresh,
  onExport,
}: Props) {
  return (
    <AdminMonitoringHero
      ariaLabel="Recomendações"
      overline="Análise estratégica"
      title="Recomendações"
      description="Analise recomendações geradas a partir das respostas e evidências validadas."
      image={ADMIN_RECOMENDACOES_HERO_IMAGE}
      loading={loading}
      onRefresh={onRefresh}
      exportAction={<ExportMenu options={OPTIONS} onExport={onExport} disabled={loading} />}
    />
  );
}
