import { ChevronLeft, ChevronRight } from "lucide-react";
import type { RespondentEvidenceItem } from "@/features/evidences/respondent-service";
import { formSurface } from "@/shared/layout/form-surface";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { TableSkeleton } from "@/shared/ui/components/loading";
import { PanelSection } from "@/shared/ui/components/panel-section";
import type { RespondentFilterValue } from "./respondent-evidence-filters";
import { RespondentEvidenceEmptyState } from "./respondent-evidence-empty-state";
import { RespondentEvidenceList } from "./respondent-evidence-list";

export function RespondentEvidenceHistorySection({
  items,
  total,
  offset,
  pageSize,
  filter,
  loading,
  listError,
  listAvailable,
  showingAdjustmentFocus,
  hasActiveFilters,
  pendingTotal,
  statsAllZero,
  returnPath,
  navigate,
  clearFilters,
  retry,
  openDetail,
}: {
  items: RespondentEvidenceItem[];
  total: number;
  offset: number;
  pageSize: number;
  filter: RespondentFilterValue;
  loading: boolean;
  listError: string | null;
  listAvailable: boolean;
  showingAdjustmentFocus: boolean;
  hasActiveFilters: boolean;
  pendingTotal: number;
  statsAllZero: boolean;
  returnPath: string;
  navigate(filter: RespondentFilterValue, offset?: number): void;
  clearFilters(): void;
  retry(): void | Promise<void>;
  openDetail(item: RespondentEvidenceItem): void;
}) {
  const pageStart = items.length > 0 ? offset + 1 : 0;
  const pageEnd = offset + items.length;
  const unavailable = Boolean(listError && !listAvailable);

  return (
    <PanelSection
      title="Lista de evidências"
      description={
        showingAdjustmentFocus
          ? "Recorte das evidências com ajuste solicitado no escopo filtrado."
          : "Histórico dos envios já avaliados ou aguardando validação. Pendências de ajuste ficam na aba Ajustes solicitados."
      }
      variant="plain"
      hideTitle
    >
      <div className="space-y-3">
        {listError && listAvailable ? (
          <AsyncErrorState
            compact
            title="A lista pode estar desatualizada"
            message={listError}
            onRetry={retry}
            retrying={loading}
          />
        ) : null}

        {loading && items.length === 0 ? (
          <div className={formSurface.card}>
            <div className="p-4"><TableSkeleton rows={4} cols={3} /></div>
          </div>
        ) : unavailable ? (
          <AsyncErrorState
            message={listError ?? "Falha ao carregar as evidências."}
            onRetry={retry}
            retrying={loading}
          />
        ) : items.length === 0 ? (
          <EvidenceEmptyResult
            showingAdjustmentFocus={showingAdjustmentFocus}
            filter={filter}
            hasActiveFilters={hasActiveFilters}
            pendingTotal={pendingTotal}
            statsAllZero={statsAllZero}
            navigate={navigate}
            clearFilters={clearFilters}
          />
        ) : (
          <RespondentEvidenceList items={items} onOpenDetail={openDetail} returnPath={returnPath} />
        )}
      </div>

      {total > pageSize && !unavailable ? (
        <div className={`${formSurface.nestedCard} mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600`}>
          <span>
            Mostrando <span className="font-semibold text-slate-700">{pageStart}-{pageEnd}</span> de{" "}
            <span className="font-semibold text-slate-700">{total}</span> evidências
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={offset === 0 || loading}
              onClick={() => navigate(filter, Math.max(0, offset - pageSize))}
              className={`${formSurface.secondaryButtonSm} disabled:opacity-50`}
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Anterior
            </button>
            <button
              type="button"
              disabled={pageEnd >= total || loading}
              onClick={() => navigate(filter, offset + pageSize)}
              className={`${formSurface.secondaryButtonSm} disabled:opacity-50`}
            >
              Próxima <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </PanelSection>
  );
}

function EvidenceEmptyResult({
  showingAdjustmentFocus,
  filter,
  hasActiveFilters,
  pendingTotal,
  statsAllZero,
  navigate,
  clearFilters,
}: {
  showingAdjustmentFocus: boolean;
  filter: RespondentFilterValue;
  hasActiveFilters: boolean;
  pendingTotal: number;
  statsAllZero: boolean;
  navigate(filter: RespondentFilterValue): void;
  clearFilters(): void;
}) {
  const unrestrictedAdjustmentFilter =
    showingAdjustmentFocus &&
    !filter.formId &&
    !filter.cycleId &&
    !filter.axisName &&
    !filter.sectionName &&
    !filter.search.trim();

  if (unrestrictedAdjustmentFilter) {
    return (
      <RespondentEvidenceEmptyState
        variant="no-pendency"
        onViewAll={() => navigate({ ...filter, status: "", pendingOnly: false })}
      />
    );
  }
  if (hasActiveFilters) {
    return <RespondentEvidenceEmptyState variant="no-results" hasActiveFilters onClearFilters={clearFilters} />;
  }
  if (pendingTotal > 0) return <RespondentEvidenceEmptyState variant="history-in-inbox" />;
  if (statsAllZero) return <RespondentEvidenceEmptyState variant="nothing-sent" />;
  return <RespondentEvidenceEmptyState variant="history-in-inbox" />;
}
