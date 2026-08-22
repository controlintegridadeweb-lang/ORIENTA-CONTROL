import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/infrastructure/auth/current-user";
import {
  adminPendenciesGlobal,
  evidenceStatusBreakdownGlobal,
  recentActivities,
} from "@/features/dashboard/queries";
import { RecommendationsAdminService } from "@/features/improvement-management/server";
import { ActivityFeed } from "@/features/dashboard/components/activity-feed";
import { DashboardDeferredSkeleton } from "@/features/dashboard/components/dashboard-section-skeleton";
import { DashboardEvidenceStatusPanel } from "@/features/dashboard/components/dashboard-evidence-status-panel";
import { DashboardMaturityByAxisPanel } from "@/features/dashboard/components/dashboard-maturity-by-axis-panel";
import { PendenciesList } from "@/features/dashboard/components/pendencies-list";
import { SectionHeader } from "@/shared/ui/components/section-header";
import { formSurface } from "@/shared/layout/form-surface";
import { layout, typography } from "@/shared/layout/design-system";

async function AdminDashboardDeferredContent() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [evidenceStatus, activities, pendencies, filterOptions] = await Promise.all([
    evidenceStatusBreakdownGlobal(),
    recentActivities(8),
    adminPendenciesGlobal(),
    new RecommendationsAdminService().listFilterOptions({
      role: user.role,
      organizationId: user.organizationId,
    }),
  ]);

  const pendenciesCount = pendencies.total;

  return (
    <>
      <section className={layout.sectionStack}>
        <SectionHeader
          kicker={pendenciesCount > 0 ? "Requer atenção" : undefined}
          title="Pendências"
          description={pendenciesCount > 0 ? "Decisões ou encaminhamentos pendentes" : undefined}
          actions={
            pendenciesCount > 0 ? (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200 sm:text-sm">
                {pendenciesCount} em aberto
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200 sm:text-sm">
                Tudo em dia
              </span>
            )
          }
        />
        <div
          className={`${formSurface.dashboardPanel} ${pendenciesCount > 0 ? formSurface.dashboardPanelPadding : "px-6 py-5 md:px-7 md:py-6"}`}
        >
          <PendenciesList items={pendencies.items} />
          {pendencies.total > 0 ? (
            <div className="mt-4 border-t border-slate-100 pt-4 text-right">
              <Link
                href="/admin/plano-acao?status=not_started"
                className={formSurface.secondaryButtonSm}
              >
                {pendencies.total > pendencies.items.length
                  ? `Ver todas as pendências (${pendencies.total})`
                  : "Abrir lista completa"}
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section className={layout.sectionStack}>
        <h2 className={typography.sectionTitle}>Análise de maturidade</h2>
        <div className={layout.maturityAndEvidenceGrid}>
          <div className="xl:col-span-3">
            <DashboardMaturityByAxisPanel
              initialAxes={[]}
              filterOptions={filterOptions}
            />
          </div>
          <div className="xl:col-span-2">
            <DashboardEvidenceStatusPanel
              initialData={evidenceStatus}
              initialOrganizationId=""
              filterOptions={filterOptions}
            />
          </div>
        </div>
      </section>

      <section className={layout.sectionStack}>
        <SectionHeader
          kicker="Auditoria"
          title="Atividades recentes"
          description="Eventos recentes no sistema"
        />
        <div className={`${formSurface.dashboardPanel} ${formSurface.dashboardPanelPadding}`}>
          <ActivityFeed activities={activities} />
        </div>
      </section>
    </>
  );
}

export function AdminDashboardDeferred() {
  return (
    <Suspense fallback={<DashboardDeferredSkeleton />}>
      <AdminDashboardDeferredContent />
    </Suspense>
  );
}
