"use client";

import { IllustratedPageHero } from "@/shared/ui/components/illustrated-page-hero";
import { RefreshActionButton } from "@/shared/ui/components/refresh-action-button";
import { EvidencesExportMenu } from "@/features/evidences/components/admin/evidences-export-menu";
import { evidenceLabels } from "@/shared/labels/official-labels";
import { ADMIN_EVIDENCES_HERO_IMAGE } from "@/shared/config/page-assets/admin-evidences-hero-image";
import type { ListEvidencesFilters } from "@/features/evidences/client";

type Props = {
  onRefresh: () => void;
  refreshing: boolean;
  exportFilters: ListEvidencesFilters;
  selectedIds: string[];
};

export function AdminEvidencesHero({ onRefresh, refreshing, exportFilters, selectedIds }: Props) {
  return (
    <IllustratedPageHero
      theme="admin"
      size="compact"
      ariaLabel="Evidências"
      overline="Validação e auditoria"
      title="Evidências"
      description={evidenceLabels.navDescription}
      image={ADMIN_EVIDENCES_HERO_IMAGE}
      priority
      actions={
        <>
          <RefreshActionButton onRefresh={onRefresh} refreshing={refreshing} />
          <EvidencesExportMenu filters={exportFilters} selectedIds={selectedIds} disabled={refreshing} />
        </>
      }
    />
  );
}
