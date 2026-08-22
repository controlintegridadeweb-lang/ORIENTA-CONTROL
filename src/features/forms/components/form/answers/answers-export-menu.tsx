"use client";

import { FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { ExportMenu, type ExportMenuOption } from "@/shared/ui/components/export-menu";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import { downloadAnswersExport } from "@/features/forms/answers-client";
import type { AnswersExportFormat, AnswersListFilters } from "@/features/forms/answers-types";

type Props = { formId: string; filters: AnswersListFilters };

const OPTIONS: Array<ExportMenuOption<AnswersExportFormat>> = [
  { format: "pdf", label: "Exportar PDF", icon: FileText, hint: "Relatório com resumo e lista de respondentes." },
  { format: "csv", label: "Exportar CSV", icon: Table2, hint: "Arquivo separado por ponto e vírgula, compatível com Excel pt-BR." },
  { format: "xlsx", label: "Exportar Excel", icon: FileSpreadsheet, hint: "Planilha .xlsx com abas de respondentes e resumo." },
];

export function AnswersExportMenu({ formId, filters }: Props) {
  async function handleExport(format: AnswersExportFormat) {
    await notify.promise(downloadAnswersExport(formId, format, { filters }), {
      loading: `Gerando ${format.toUpperCase()}...`,
      success: "Pronto. Download iniciado.",
      error: (error) => describeError(error, "Falha ao exportar."),
    });
  }

  return <ExportMenu options={OPTIONS} onExport={handleExport} />;
}
