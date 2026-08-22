import type { ReactNode } from "react";
import { AdminListScopeBanner } from "@/shared/ui/admin/admin-list-scope-banner";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { ServerPagination } from "@/shared/ui/components/server-pagination";
import type { AdminListScopePart } from "@/shared/ui/admin/admin-list-scope-banner";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";

export type AdminMonitoringResultLabel = { singular: string; plural: string };

type Props = {
  title: string;
  description: string;
  total: number;
  summaryTotal: number;
  hasCardFilter: boolean;
  scopeParts: AdminListScopePart[];
  viewSwitcher: ReactNode;
  content: ReactNode;
  page: number;
  pageSize: number;
  paginationTotal: number;
  totalPages: number;
  pageItemCount: number;
  onPageChange: (page: number) => void;
  resultLabel: AdminMonitoringResultLabel;
  paginationAriaLabel: string;
};

export function AdminMonitoringResultsSection({
  title,
  description,
  total,
  summaryTotal,
  hasCardFilter,
  scopeParts,
  viewSwitcher,
  content,
  page,
  pageSize,
  paginationTotal,
  totalPages,
  pageItemCount,
  onPageChange,
  resultLabel,
  paginationAriaLabel,
}: Props) {
  return (
    <PanelSection
      title={title}
      description={description}
      variant="plain"
      actions={
        <p className={`${typography.meta} text-right`}>
          <span className="font-semibold tabular-nums text-slate-800">{total}</span>{" "}
          {total === 1 ? "resultado" : "resultados"}
          {hasCardFilter ? (
            <>
              {" "}de <span className="tabular-nums text-slate-600">{summaryTotal}</span> no recorte
            </>
          ) : (
            " no recorte"
          )}
        </p>
      }
    >
      <div className={`${formSurface.dashboardPanel} ${formSurface.dashboardPanelPadding} space-y-4`}>
        <AdminListScopeBanner parts={scopeParts} />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          {viewSwitcher}
        </div>
        {content}
        {total > 0 ? (
          <ServerPagination
            page={page}
            pageSize={pageSize}
            totalItems={paginationTotal}
            totalPages={totalPages}
            pageItemCount={pageItemCount}
            onPageChange={onPageChange}
            resultLabel={resultLabel}
            aria-label={paginationAriaLabel}
          />
        ) : null}
      </div>
    </PanelSection>
  );
}
