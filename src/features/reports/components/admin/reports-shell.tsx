"use client";

import { ADMIN_PAGE_HERO_BLEED } from "@/shared/layout/admin-page-layout";
import { layout } from "@/shared/layout/design-system";
import { AdminReportsHero } from "./admin-reports-hero";
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
    <div className={layout.pageStack}>
      <div className={ADMIN_PAGE_HERO_BLEED}>
        <AdminReportsHero />
      </div>
      <section className={`${layout.panelStack} pt-1`}>
        <ReportEmissionSection controller={controller} />
        <ReportHistorySection controller={controller} />
      </section>
    </div>
  );
}
