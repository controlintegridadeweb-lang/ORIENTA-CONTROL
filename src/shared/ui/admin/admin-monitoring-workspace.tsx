import type { ReactNode } from "react";
import { AdminMonitoringPage } from "@/shared/ui/admin/admin-monitoring-page";
import {
  AdminMonitoringResultsSection,
  type AdminMonitoringResultLabel,
} from "@/shared/ui/admin/admin-monitoring-results-section";
import type { AdminListScopePart } from "@/shared/ui/admin/admin-list-scope-banner";
import { PanelSection } from "@/shared/ui/components/panel-section";


type Props = {
  hero: ReactNode;
  error: string | null;
  loading: boolean;
  onRetry: () => Promise<void>;
  indicators: ReactNode;
  filters: ReactNode;
  filtersDescription: string;
  resultsDescription: string;
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

/** Estrutura visual comum das filas de Recomendações e Plano de integridade e compliance. */
export function AdminMonitoringWorkspace({
  hero,
  error,
  loading,
  onRetry,
  indicators,
  filters,
  filtersDescription,
  resultsDescription,
  ...results
}: Props) {
  return (
    <AdminMonitoringPage
      hero={hero}
      error={error}
      loading={loading}
      onRetry={onRetry}
    >
      <PanelSection
        title="Indicadores"
        description="Selecione um indicador para filtrar a lista."
        variant="plain"
      >
        {indicators}
      </PanelSection>

      <PanelSection
        title="Filtros"
        description={filtersDescription}
        variant="plain"
      >
        {filters}
      </PanelSection>

      <AdminMonitoringResultsSection
        title="Resultados"
        description={resultsDescription}
        {...results}
      />
    </AdminMonitoringPage>
  );
}
