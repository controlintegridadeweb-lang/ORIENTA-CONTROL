import { Suspense } from "react";
import { AdminDashboardDeferred } from "@/features/dashboard/components/admin-dashboard-deferred";
import { AdminDashboardKpisSection } from "@/features/dashboard/components/admin-dashboard-kpis-section";
import { AdminDashboardHero } from "@/features/dashboard/components/admin-dashboard-hero";
import { KpiGridSkeleton } from "@/features/dashboard/components/dashboard-section-skeleton";
import { ADMIN_PAGE_HERO_BLEED } from "@/shared/layout/admin-page-layout";
import { layout } from "@/shared/layout/design-system";

export default function AdminDashboardPage() {
  return (
    <div className={layout.pageStack}>
      <div className={ADMIN_PAGE_HERO_BLEED}>
        <AdminDashboardHero />
      </div>

      <div className={`${layout.pageStack} pt-1`}>
        <Suspense fallback={<KpiGridSkeleton />}>
          <AdminDashboardKpisSection />
        </Suspense>

        <AdminDashboardDeferred />
      </div>
    </div>
  );
}
