import writeXlsxFile from "write-excel-file/node";
import { businessToday } from "@/shared/datetime/business-date";
import { xlsxHeaderCell, xlsxWrapText, excelAutoFilterFeature } from "@/shared/export/xlsx-sheet";
import type { BimonthlyReportDetail } from "./detail";

type NodeFileContent = Buffer | import("node:stream").Stream | import("node:buffer").Blob;

export async function generateBimonthlyReportExcel(
  detail: BimonthlyReportDetail,
): Promise<{ filename: string; buffer: Buffer }> {
  const summaryHeader = [xlsxHeaderCell("Indicador"), xlsxHeaderCell("Valor")];
  const summaryRows = [
    [
      "Caráter",
      "Fotografia histórica do plano de integridade e compliance no corte do bimestre.",
    ],
    ["Ações ativas", detail.summary.activeActionCount],
    ["Não iniciadas", detail.summary.notStartedCount],
    ["Em andamento", detail.summary.inProgressCount],
    ["Concluídas", detail.summary.completedCount],
    ["Atrasadas", detail.summary.overdueCount],
    ["Canceladas", detail.summary.cancelledCount],
    ["Percentual médio", detail.summary.averageProgressPercentage],
    ["Critérios concluídos", detail.summary.completedCriterionCount],
    ["Critérios pendentes", detail.summary.pendingCriterionCount],
    ["Ações concluídas no período", detail.summary.actionsCompletedInPeriod],
    ["Ações com avanço", detail.summary.actionsAdvancedInPeriod],
    ["Ações sem movimentação", detail.summary.actionsStagnantInPeriod],
    ["Ações que entraram em atraso", detail.summary.actionsBecameOverdueInPeriod],
    ["Critérios concluídos no período", detail.summary.criteriaCompletedInPeriod],
  ].map(([label, value]) => [xlsxWrapText(String(label)), value]);

  const actionHeader = [
    "Eixo",
    "Seção",
    "Pergunta",
    "Recomendação",
    "Ação",
    "Situação",
    "Progresso %",
    "Prazo",
    "Atrasada",
    "Comprovação",
    "Aceite",
    "Ajuste pendente",
    "Revisão",
  ];

  const sheets = [
    {
      sheet: "Resumo",
      data: [summaryHeader, ...summaryRows],
    },
    {
      sheet: "Ações",
      stickyRowsCount: 1,
      columns: actionHeader.map(() => ({ width: 24 })),
      data: [
        actionHeader.map((value) => xlsxHeaderCell(value)),
        ...detail.actions.map((action) => [
          xlsxWrapText(action.axisName),
          xlsxWrapText(action.sectionName),
          xlsxWrapText(action.questionPrompt),
          xlsxWrapText(action.recommendationText),
          xlsxWrapText(action.actionText),
          xlsxWrapText(action.statusLabel),
          action.progressPercentage,
          action.dueDate,
          action.overdue ? "Sim" : "Não",
          action.hasValidEvidence ? "Sim" : "Não",
          action.approved ? "Sim" : "Não",
          action.hasOpenAdjustment ? "Sim" : "Não",
          action.revision,
        ]),
      ],
    },
  ];

  const file = await writeXlsxFile(sheets, {
    fontFamily: "Arial",
    fontSize: 10,
    features: [excelAutoFilterFeature<NodeFileContent>(actionHeader.length, detail.actions.length)],
  }).toBuffer();

  return {
    filename: `relatorio-bimestral-${detail.referenceYear}-b${detail.bimester}-${businessToday()}.xlsx`,
    buffer: file,
  };
}
