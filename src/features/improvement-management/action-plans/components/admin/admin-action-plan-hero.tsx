"use client";

import Link from "next/link";
import { FileBarChart } from "lucide-react";
import { AdminMonitoringHero } from "@/features/improvement-management/monitoring/components/admin-monitoring-hero";
import { ADMIN_PLANO_ACAO_HERO_IMAGE } from "@/shared/config/page-assets/admin-action-plan-hero-image";
import { reportCatalogLabels } from "@/shared/labels/official-labels";
import { formSurface } from "@/shared/layout/form-surface";

type Props = {
  loading?: boolean;
  onRefresh: () => void;
  catalogHref: string;
};

export function AdminActionPlanHero({
  loading,
  onRefresh,
  catalogHref,
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
        <Link href={catalogHref} className={formSurface.secondaryButtonSm}>
          <FileBarChart className="h-3.5 w-3.5" aria-hidden />
          {reportCatalogLabels.bimonthlyCatalogCta}
        </Link>
      }
    />
  );
}
