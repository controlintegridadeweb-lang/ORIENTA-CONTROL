"use client";

import { FileText, Table2 } from "lucide-react";
import { ExportMenu, type ExportMenuOption } from "@/shared/ui/components/export-menu";
import type { ListEvidencesFilters } from "@/features/evidences/client";
import type { EvidenceExportFormat } from "@/features/evidences/schemas";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import { downloadEvidencesExport } from "@/features/evidences/client";

type Props = {
  filters: ListEvidencesFilters;
  selectedIds: string[];
  disabled?: boolean;
};

const OPTIONS: Array<ExportMenuOption<EvidenceExportFormat>> = [
  { format: "pdf", label: "Exportar PDF", icon: FileText, hint: "Resumo e linhas exportadas." },
  { format: "csv", label: "Exportar CSV", icon: Table2, hint: "Ponto e vírgula, Excel pt-BR." },
];

export function EvidencesExportMenu({ filters, selectedIds, disabled }: Props) {
  async function handleExport(format: EvidenceExportFormat) {
    await notify.promise(downloadEvidencesExport(format, filters, selectedIds), {
      loading: `Gerando ${format.toUpperCase()}...`,
      success: "Download iniciado.",
      error: (error) => describeError(error, "Falha ao exportar."),
    });
  }

  return <ExportMenu options={OPTIONS} onExport={handleExport} disabled={disabled} />;
}
