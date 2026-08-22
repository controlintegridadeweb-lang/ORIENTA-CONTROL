import { Spinner } from "@/shared/ui/components/loading";
import { formSurface } from "@/shared/layout/form-surface";
import { layout } from "@/shared/layout/design-system";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`.trim()}
      aria-hidden
    />
  );
}

export function KpiGridSkeleton() {
  return (
    <div className={layout.pageStack} aria-busy="true" aria-label="Carregando indicadores">
      <section className={layout.sectionStack}>
        <SkeletonBlock className="h-4 w-28" />
        <div className={layout.kpiGrid4}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-30" />
          ))}
        </div>
      </section>
      <section className={layout.sectionStack}>
        <SkeletonBlock className="h-4 w-20" />
        <div className={layout.kpiGrid2}>
          {Array.from({ length: 2 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-30" />
          ))}
        </div>
      </section>
    </div>
  );
}

export function DashboardDeferredSkeleton() {
  return (
    <div className={layout.pageStack} aria-busy="true" aria-label="Carregando análises">
      <section className={layout.sectionStack}>
        <SkeletonBlock className="h-4 w-36" />
        <div className={`${formSurface.dashboardPanel} px-6 py-8 md:px-7`}>
          <SkeletonBlock className="mb-4 h-6 w-48" />
          <SkeletonBlock className="h-24 w-full" />
        </div>
      </section>
      <section className={layout.sectionStack}>
        <SkeletonBlock className="h-4 w-32" />
        <div className={layout.maturityAndEvidenceGrid}>
          <SkeletonBlock className="h-80 xl:col-span-3" />
          <SkeletonBlock className="h-80 xl:col-span-2" />
        </div>
      </section>
      <section className={layout.sectionStack}>
        <SkeletonBlock className="h-4 w-28" />
        <div className={`${formSurface.dashboardPanel} px-6 py-8 md:px-7`}>
          <SkeletonBlock className="mb-4 h-6 w-40" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </section>
      <p className="flex items-center justify-center gap-2 text-sm text-slate-500">
        <Spinner size="sm" label="Carregando" />
        Carregando análises e histórico…
      </p>
    </div>
  );
}
