"use client";

import { PageHeader } from "@/shared/ui/components/page-header";
import { layout } from "@/shared/layout/design-system";
import { ReportEmissionSection } from "./report-emission-section";
import { ReportHistorySection } from "./report-history-section";
import { useReportsController } from "./use-reports-controller";

export function ReportsShell({
  initialOrganizationId = null,
  initialCycleId = null,
  initialHistoryOffset = 0,
}: {
  initialOrganizationId?: string | null;
  initialCycleId?: string | null;
  initialHistoryOffset?: number;
}) {
  const controller = useReportsController({
    initialOrganizationId,
    initialCycleId,
    initialHistoryOffset,
  });

  return (
    <div className={layout.panelStack}>
      <PageHeader
        title="Relatórios"
        description="Emita versões oficiais somente para diagnósticos concluídos e consulte todas as emissões já registradas."
      />
      <ReportEmissionSection controller={controller} />
      <ReportHistorySection controller={controller} />
    </div>
  );
}
