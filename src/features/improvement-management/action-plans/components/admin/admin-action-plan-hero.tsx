"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { AdminMonitoringHero } from "@/features/improvement-management/monitoring/components/admin-monitoring-hero";
import { ADMIN_PLANO_ACAO_HERO_IMAGE } from "@/shared/config/page-assets/admin-action-plan-hero-image";
import { reportCatalogLabels } from "@/shared/labels/official-labels";
import { ExportMenu, type ExportMenuOption } from "@/shared/ui/components/export-menu";

type IntegrityPlanReportFormat = "pdf" | "xlsx";

const INTEGRITY_PLAN_EXPORT_OPTIONS: Array<ExportMenuOption<IntegrityPlanReportFormat>> = [
  {
    format: "pdf",
    label: "Exportar PDF",
    icon: FileText,
    hint: reportCatalogLabels.integrityPlanReportPdfHint,
  },
  {
    format: "xlsx",
    label: "Exportar Excel",
    icon: FileSpreadsheet,
    hint: reportCatalogLabels.integrityPlanReportXlsxHint,
  },
];

type Props = {
  loading?: boolean;
  exportDisabled?: boolean;
  onRefresh: () => void;
  onExportIntegrityPlan: (format: IntegrityPlanReportFormat) => Promise<void>;
};

export function AdminActionPlanHero({
  loading,
  exportDisabled,
  onRefresh,
  onExportIntegrityPlan,
}: Props) {
  return (
    <AdminMonitoringHero
      ariaLabel="Plano de integridade e compliance"
      overline="Execução e monitoramento"
      title="Plano de integridade e compliance"
      description="Acompanhe ações, responsáveis, prazos, progresso e riscos vinculados às recomendações."
      image={ADMIN_PLANO_ACAO_HERO_IMAGE}
      loading={loading}
      onRefresh={onRefresh}
      catalogAction={
        <ExportMenu
          label={reportCatalogLabels.integrityPlanReportCta}
          options={INTEGRITY_PLAN_EXPORT_OPTIONS}
          onExport={onExportIntegrityPlan}
          disabled={loading || exportDisabled}
        />
      }
    />
  );
}
