"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { AdminMonitoringHero } from "@/features/improvement-management/monitoring/components/admin-monitoring-hero";
import type { ActionPlanExportFormat } from "@/features/improvement-management/action-plans/export/action-plan-export-types";
import { ADMIN_PLANO_ACAO_HERO_IMAGE } from "@/shared/config/page-assets/admin-action-plan-hero-image";
import { ExportMenu, type ExportMenuOption } from "@/shared/ui/components/export-menu";

type Props = {
  loading?: boolean;
  onRefresh: () => void;
  onExport: (format: ActionPlanExportFormat) => Promise<void>;
};

const OPTIONS: Array<ExportMenuOption<ActionPlanExportFormat>> = [
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
    hint: "Relatório institucional agrupado por eixo, seção e recomendação.",
  },
];

export function AdminActionPlanHero({
  loading,
  onRefresh,
  onExport,
}: Props) {
  return (
    <AdminMonitoringHero
      ariaLabel="Plano de ação"
      overline="Execução e monitoramento"
      title="Plano de ação"
      description="Acompanhe ações, responsáveis, prazos, progresso e riscos vinculados às recomendações."
      image={ADMIN_PLANO_ACAO_HERO_IMAGE}
      loading={loading}
      onRefresh={onRefresh}
      exportAction={<ExportMenu options={OPTIONS} onExport={onExport} disabled={loading} />}
    />
  );
}
