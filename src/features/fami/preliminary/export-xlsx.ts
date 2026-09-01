import writeXlsxFile from "write-excel-file/node";
import { businessToday } from "@/shared/datetime/business-date";
import { famiPreliminaryLabels } from "@/shared/labels/official-labels";
import { formatPreliminaryPercentage, formatPreliminaryScore } from "./panel-presentation";
import type { PreliminaryExportDetail } from "./export-detail";
import { preliminaryExportPeriodLabel } from "./export-detail";
import { xlsxHeaderCell, xlsxWrapText, excelAutoFilterFeature } from "@/shared/export/xlsx-sheet";
import { criterionEvolutionLabel } from "./evolution";

type NodeFileContent = Buffer | import("node:stream").Stream | import("node:buffer").Blob;

export const PRELIMINARY_EXPORT_DISCLAIMER =
  "FAMI preliminar quadrimestral. Não oficial: não substitui o FAMI anual.";

export async function generatePreliminaryExportExcel(
  detail: PreliminaryExportDetail,
): Promise<{ filename: string; buffer: Buffer }> {
  const { checkpoint, evolution } = detail;
  const summaryHeader = [xlsxHeaderCell("Indicador"), xlsxHeaderCell("Valor")];
  const summaryRows = [
    ["Caráter", PRELIMINARY_EXPORT_DISCLAIMER],
    ["Organização", detail.organizationName],
    ["Formulário", detail.formName],
    ["Período", preliminaryExportPeriodLabel(checkpoint.referenceYear, checkpoint.quadrimester)],
    ["Corte", checkpoint.periodEnd],
    [famiPreliminaryLabels.officialFami, formatPreliminaryScore(checkpoint.official)],
    [famiPreliminaryLabels.panoramaLabel, formatPreliminaryScore(checkpoint.preliminary)],
    [
      "Variação em pontos percentuais",
      checkpoint.deltaPercentagePoints == null
        ? "—"
        : formatPreliminaryPercentage(checkpoint.deltaPercentagePoints),
    ],
    [
      famiPreliminaryLabels.criteriaNowScoring,
      evolution?.criteriaNowScoring ?? 0,
    ],
    [famiPreliminaryLabels.recoveredPoints, evolution?.recoveredPoints ?? 0],
    ["Metodologia", checkpoint.methodologyVersion],
    ["Versão do cálculo", checkpoint.calculationVersion],
    ["Calculado em", checkpoint.calculatedAt],
  ].map(([label, value]) => [xlsxWrapText(String(label)), value]);

  const criterionHeader = [
    "Critério",
    "Pontos oficiais",
    "Pontos preliminares",
    "Pontos recuperados",
    "Critério concluído",
    "Ações ativas",
    "Ações concluídas",
    "Evolução",
  ];

  const evolutionRows = evolution?.rows ?? [];
  const evolutionByQuestion = new Map(
    evolutionRows.map((row) => [row.questionVersionId, row]),
  );

  const sheets = [
    {
      sheet: "Resumo FAMI",
      data: [summaryHeader, ...summaryRows],
    },
    {
      sheet: "Por eixo",
      data: [
        [xlsxHeaderCell("Eixo"), xlsxHeaderCell("%"), xlsxHeaderCell("Nível"), xlsxHeaderCell("Pontos")],
        ...detail.famiByAxis.map((axis) => [
          xlsxWrapText(axis.axisName),
          axis.percentage,
          axis.maturityLevel == null ? "N/A" : `N${axis.maturityLevel}`,
          `${axis.pointsObtained.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${axis.pointsPossible.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        ]),
      ],
    },
    {
      sheet: "Por seção",
      stickyRowsCount: 1,
      columns: ["Eixo", "Seção", "%", "Nível", "Pontos"].map(() => ({ width: 24 })),
      data: [
        ["Eixo", "Seção", "%", "Nível", "Pontos"].map((value) => xlsxHeaderCell(value)),
        ...detail.famiSections.map((section) => {
          const axisName =
            detail.famiByAxis.find((axis) => axis.axisId === section.axisId)?.axisName ?? "—";
          return [
            xlsxWrapText(axisName),
            xlsxWrapText(section.sectionName),
            section.percentage,
            section.maturityLevel == null ? "N/A" : `N${section.maturityLevel}`,
            `${section.pointsObtained.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${section.pointsPossible.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          ];
        }),
      ],
    },
    {
      sheet: "Critérios",
      stickyRowsCount: 1,
      columns: criterionHeader.map(() => ({ width: 24 })),
      data: [
        criterionHeader.map((value) => xlsxHeaderCell(value)),
        ...detail.criteria.map((row) => {
          const evolutionRow = evolutionByQuestion.get(row.questionVersionId);
          return [
            xlsxWrapText(row.questionPrompt),
            row.officialPoints,
            row.preliminaryPoints,
            row.recoveredPoints,
            row.criterionCompleted ? "Sim" : "Não",
            row.activeActionCount,
            row.completedActionCount ?? "—",
            evolutionRow
              ? xlsxWrapText(
                  `${criterionEvolutionLabel(evolutionRow.previousStatus)} → ${criterionEvolutionLabel(evolutionRow.currentStatus)}`,
                )
              : "—",
          ];
        }),
      ],
    },
  ];

  const file = await writeXlsxFile(sheets, {
    fontFamily: "Arial",
    fontSize: 10,
    features: [
      excelAutoFilterFeature<NodeFileContent>(criterionHeader.length, detail.criteria.length),
    ],
  }).toBuffer();

  return {
    filename: `fami-preliminar-${checkpoint.referenceYear}-q${checkpoint.quadrimester}-${businessToday()}.xlsx`,
    buffer: file,
  };
}
