"use client";

import { ActionPlanProgressUpdatesList } from "@/features/improvement-management/action-plans/components/execution/view-action-details-panel";
import type { ActionPlanProgressUpdate } from "@/features/improvement-management/action-plans/types";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { typography } from "@/shared/layout/design-system";

type Props = {
  items: ActionPlanProgressUpdate[];
  loading: boolean;
};

export function RecentActivitySection({ items, loading }: Props) {
  return (
    <PanelSection title="Histórico da ação" size="compact">
      {loading && items.length === 0 ? (
        <p className={typography.auxiliary}>Carregando atualizações…</p>
      ) : (
        <ActionPlanProgressUpdatesList items={items} />
      )}
    </PanelSection>
  );
}
