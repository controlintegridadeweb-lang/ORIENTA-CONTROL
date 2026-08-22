import type { RespondentEvidenceItem } from "@/features/evidences/respondent-service";
import { evidenceLabels } from "@/shared/labels/official-labels";
import { formSurface } from "@/shared/layout/form-surface";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { TableSkeleton } from "@/shared/ui/components/loading";
import { PanelSection } from "@/shared/ui/components/panel-section";
import type { RespondentFilterValue } from "./respondent-evidence-filters";
import { RespondentComplementationRequests } from "./respondent-complementation-requests";

type Navigate = (filter: RespondentFilterValue, offset?: number) => void;

export function RespondentEvidenceActionSection({
  pendingError,
  pendingLoading,
  pendingAvailable,
  pendingItems,
  pendingTotal,
  returnPath,
  navigate,
  retry,
  openDetail,
}: {
  pendingError: string | null;
  pendingLoading: boolean;
  pendingAvailable: boolean;
  pendingItems: RespondentEvidenceItem[];
  pendingTotal: number;
  returnPath: string;
  navigate: Navigate;
  retry(): void | Promise<void>;
  openDetail(item: RespondentEvidenceItem): void;
}) {
  return (
    <PanelSection
      title={evidenceLabels.sectionTitle}
      description={
        pendingError
          ? "Não foi possível confirmar a fila global de ajustes. Recarregue antes de considerar as pendências como atualizadas."
          : pendingTotal > 0
            ? evidenceLabels.sectionDescription
            : "Quando a equipe solicitar ajuste ou comprovação, a pendência aparecerá aqui."
      }
      actions={<PendingStatusBadge
        error={Boolean(pendingError)}
        loading={pendingLoading && !pendingAvailable}
        total={pendingTotal}
      />}
      variant="plain"
      hideTitle
    >
      <div className="space-y-3">
        {pendingError ? (
          <AsyncErrorState compact message={pendingError} onRetry={retry} retrying={pendingLoading} />
        ) : null}
        {pendingLoading && !pendingAvailable ? (
          <div className={formSurface.card}>
            <div className="p-4"><TableSkeleton rows={2} cols={2} /></div>
          </div>
        ) : !pendingError || pendingAvailable ? (
          <RespondentComplementationRequests
            items={pendingItems}
            total={pendingTotal}
            onViewAll={() => navigate({
              search: "",
              cycleId: "",
              formId: "",
              status: "adjustment_requested",
              axisName: "",
              sectionName: "",
              pendingOnly: true,
            })}
            onOpenDetail={openDetail}
            returnPath={returnPath}
          />
        ) : null}
      </div>
    </PanelSection>
  );
}

function PendingStatusBadge({
  error,
  loading,
  total,
}: {
  error: boolean;
  loading: boolean;
  total: number;
}) {
  if (error) {
    return <span className={`inline-flex ${formSurface.badge.base} ${formSurface.badge.neutral}`}>Fila indisponível</span>;
  }
  if (loading) {
    return <span className={`inline-flex ${formSurface.badge.base} ${formSurface.badge.neutral}`}>Atualizando fila</span>;
  }
  if (total > 0) {
    return (
      <span className={`inline-flex ${formSurface.badge.base} ${formSurface.badge.warning}`}>
        Requer atenção · {total} {total === 1 ? "pendência" : "pendências"}
      </span>
    );
  }
  return <span className={`inline-flex ${formSurface.badge.base} ${formSurface.badge.success}`}>Tudo em dia</span>;
}
