import { structuralAxisOrderIndex } from "@/shared/domain/axis";
import { latinPdfSafe } from "@/shared/export/text";
import type { ReportFamiSectionScore } from "@/features/reports/pdf/report-types";
import { formatReportPercentage, formatReportPoints } from "../formatters";
import type { Cursor, OrientaPdfDocument } from "../document";
import {
  contentWidth,
  reportAxisTheme,
  reportMaturityLevelTheme,
  reportTheme,
} from "../theme";
import { drawFilledPill, drawProgressBar } from "../helpers";
import { drawFamiRadarChart } from "../primitives/radar-chart";

const TABLE_PAD = 10;
const HEADER_H = 22;
const GROUP_H = 20;
const CELL_SIZE = 8;
const ROW_MIN_H = 34;

type ColumnAlign = "left" | "center" | "right";
type TableColumn = { header: string; width: number; align: ColumnAlign };

function sectionsForAxis(
  sections: ReportFamiSectionScore[],
  axisId: string | null,
): ReportFamiSectionScore[] {
  if (axisId == null) return [];
  return sections.filter((section) => section.axisId === axisId);
}

function orderedAxes(doc: OrientaPdfDocument) {
  return [...doc.data.fami.byAxis].sort(
    (a, b) =>
      structuralAxisOrderIndex(a.axisName) - structuralAxisOrderIndex(b.axisName) ||
      a.axisName.localeCompare(b.axisName, "pt-BR"),
  );
}

function wrapText(
  doc: OrientaPdfDocument,
  text: string,
  size: number,
  maxWidth: number,
): string[] {
  const words = latinPdfSafe(text).replace(/\s+/g, " ").trim().split(" ");
  if (words.length === 0 || words[0] === "") return [];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (doc.fonts.regular.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function tableColumns(): TableColumn[] {
  const inner = contentWidth() - TABLE_PAD * 2;
  const order = 48;
  const pct = 64;
  const level = 84;
  const points = 86;
  return [
    { header: "ORDEM", width: order, align: "left" },
    { header: "SEÇÃO", width: inner - order - pct - level - points, align: "left" },
    { header: "%", width: pct, align: "center" },
    { header: "NÍVEL", width: level, align: "center" },
    { header: "PONTOS", width: points, align: "right" },
  ];
}

function columnX(columns: TableColumn[], index: number): number {
  let x = reportTheme.margin + TABLE_PAD;
  for (let i = 0; i < index; i++) x += columns[i]!.width;
  return x;
}

function alignedX(
  columns: TableColumn[],
  index: number,
  textWidth: number,
): number {
  const left = columnX(columns, index);
  const column = columns[index]!;
  if (column.align === "center") return left + (column.width - textWidth) / 2;
  if (column.align === "right") return left + column.width - textWidth;
  return left;
}

function drawOverviewHeading(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  title: string,
  subtitle: string,
): Cursor {
  const needed = 52;
  let cur = doc.ensureSpace(cursor, needed + 36);
  cur.page.drawText(latinPdfSafe(title), {
    x: reportTheme.margin,
    y: cur.y,
    size: 12,
    font: doc.fonts.bold,
    color: reportTheme.slate900,
  });
  cur = { ...cur, y: cur.y - 20 };
  cur.page.drawText(latinPdfSafe(subtitle), {
    x: reportTheme.margin,
    y: cur.y,
    size: 9,
    font: doc.fonts.regular,
    color: reportTheme.slate500,
    maxWidth: contentWidth(),
  });
  cur = { ...cur, y: cur.y - 16 };
  cur.page.drawLine({
    start: { x: reportTheme.margin, y: cur.y },
    end: { x: reportTheme.margin + contentWidth(), y: cur.y },
    thickness: 0.6,
    color: reportTheme.slate200,
  });
  return { ...cur, y: cur.y - 18 };
}

function drawAxisScoreRows(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  axes: Array<{ axisName: string; percentage: number; maturityLevel: number | null }>,
): Cursor {
  const w = contentWidth();
  let cur = cursor;
  for (const axis of axes) {
    const rowH = 36;
    cur = doc.ensureSpace(cur, rowH + 4);
    const theme = reportAxisTheme(axis.axisName);
    const baseline = cur.y - 12;
    cur.page.drawCircle({
      x: reportTheme.margin + 4,
      y: baseline + 3,
      size: 3.2,
      color: theme.primary,
    });
    cur.page.drawText(latinPdfSafe(axis.axisName), {
      x: reportTheme.margin + 14,
      y: baseline,
      size: 10,
      font: doc.fonts.bold,
      color: theme.primary,
    });
    const value =
      axis.maturityLevel == null ? "N/A" : formatReportPercentage(axis.percentage);
    const valueW = doc.fonts.bold.widthOfTextAtSize(value, 10);
    cur.page.drawText(value, {
      x: reportTheme.margin + w - valueW,
      y: baseline,
      size: 10,
      font: doc.fonts.bold,
      color: reportTheme.slate700,
    });
    drawProgressBar(
      cur.page,
      reportTheme.margin + 14,
      baseline - 10,
      w - 14 - valueW - 12,
      axis.maturityLevel == null ? 0 : axis.percentage,
      theme.primary,
      4,
    );
    cur = { ...cur, y: cur.y - rowH };
  }
  return { ...cur, y: cur.y - 8 };
}

function drawSectionPerformanceTable(
  doc: OrientaPdfDocument,
  cursor: Cursor,
  axes: ReturnType<typeof orderedAxes>,
): Cursor {
  const w = contentWidth();
  const columns = tableColumns();

  const drawHeader = (cur: Cursor): Cursor => {
    const next = doc.ensureSpace(cur, HEADER_H + 4);
    next.page.drawRectangle({
      x: reportTheme.margin,
      y: next.y - HEADER_H,
      width: w,
      height: HEADER_H,
      color: reportTheme.tableHeader,
    });
    columns.forEach((column, index) => {
      const width = doc.fonts.bold.widthOfTextAtSize(column.header, 7);
      next.page.drawText(column.header, {
        x: alignedX(columns, index, width),
        y: next.y - HEADER_H / 2 - 2,
        size: 7,
        font: doc.fonts.bold,
        color: reportTheme.white,
      });
    });
    return { ...next, y: next.y - HEADER_H };
  };

  let cur = drawHeader(cursor);
  let fallbackOrder = 0;

  for (const axis of axes) {
    const axisSections = sectionsForAxis(doc.data.fami.sections, axis.axisId);
    if (axisSections.length === 0) continue;
    const theme = reportAxisTheme(axis.axisName);

    if (cur.y - GROUP_H < doc.contentBottom) {
      cur = doc.newPage();
      cur = drawHeader(cur);
    }
    cur.page.drawRectangle({
      x: reportTheme.margin,
      y: cur.y - GROUP_H,
      width: w,
      height: GROUP_H,
      color: theme.strong,
    });
    cur.page.drawText(latinPdfSafe(axis.axisName), {
      x: columnX(columns, 0),
      y: cur.y - GROUP_H / 2 - 3,
      size: 8,
      font: doc.fonts.bold,
      color: reportTheme.white,
    });
    cur = { ...cur, y: cur.y - GROUP_H };

    for (const section of axisSections) {
      fallbackOrder += 1;
      const displayOrder = section.sectionOrder ?? fallbackOrder;
      const nameLines = wrapText(
        doc,
        section.sectionName,
        CELL_SIZE,
        columns[1]!.width - 4,
      );
      const rowH = Math.max(ROW_MIN_H, nameLines.length * 11 + 16);

      if (cur.y - rowH < doc.contentBottom) {
        cur = doc.newPage();
        cur = drawHeader(cur);
      }

      const top = cur.y;
      const mid = top - rowH / 2;
      const baseline = mid - 3;
      const firstLineY = mid + ((nameLines.length - 1) * 11) / 2 - 3;
      cur.page.drawLine({
        start: { x: reportTheme.margin, y: top - rowH },
        end: { x: reportTheme.margin + w, y: top - rowH },
        thickness: 0.4,
        color: reportTheme.slate200,
      });

      const orderLabel = String(displayOrder);
      cur.page.drawText(orderLabel, {
        x: alignedX(
          columns,
          0,
          doc.fonts.bold.widthOfTextAtSize(orderLabel, CELL_SIZE),
        ),
        y: baseline,
        size: CELL_SIZE,
        font: doc.fonts.bold,
        color: theme.text,
      });

      let lineY = firstLineY;
      for (const line of nameLines) {
        cur.page.drawText(line, {
          x: columnX(columns, 1),
          y: lineY,
          size: CELL_SIZE,
          font: doc.fonts.regular,
          color: reportTheme.slate900,
        });
        lineY -= 11;
      }

      const pctCol = columns[2]!;
      const pctX = columnX(columns, 2);
      const pctLabel =
        section.maturityLevel == null
          ? "N/A"
          : formatReportPercentage(section.percentage);
      cur.page.drawText(pctLabel, {
        x: alignedX(
          columns,
          2,
          doc.fonts.bold.widthOfTextAtSize(pctLabel, CELL_SIZE),
        ),
        y: baseline + 4,
        size: CELL_SIZE,
        font: doc.fonts.bold,
        color: section.maturityLevel == null ? reportTheme.slate500 : theme.text,
      });
      const barW = Math.min(44, pctCol.width - 8);
      drawProgressBar(
        cur.page,
        pctX + (pctCol.width - barW) / 2,
        baseline - 5,
        barW,
        section.maturityLevel == null ? 0 : section.percentage,
        theme.primary,
        3,
      );

      const levelLabel =
        section.maturityLevel == null ? "N/A" : `Nível ${section.maturityLevel}`;
      const levelColors = reportMaturityLevelTheme(section.maturityLevel);
      const levelPad = 5;
      const levelH = 13;
      const levelW =
        doc.fonts.bold.widthOfTextAtSize(levelLabel, 7) + levelPad * 2;
      const levelX = alignedX(columns, 3, levelW);
      const levelY = mid - levelH / 2;
      drawFilledPill(cur.page, levelX, levelY, levelW, levelH, levelColors.bg);
      cur.page.drawText(levelLabel, {
        x: levelX + levelPad,
        y: levelY + 3,
        size: 7,
        font: doc.fonts.bold,
        color: levelColors.text,
      });

      const pointsLabel = formatReportPoints(
        section.pointsObtained,
        section.pointsPossible,
      );
      cur.page.drawText(pointsLabel, {
        x: alignedX(
          columns,
          4,
          doc.fonts.regular.widthOfTextAtSize(pointsLabel, CELL_SIZE),
        ),
        y: baseline,
        size: CELL_SIZE,
        font: doc.fonts.regular,
        color: reportTheme.slate700,
      });

      cur = { ...cur, y: top - rowH };
    }
  }

  return { ...cur, y: cur.y - 8 };
}

/**
 * Conteúdo da análise detalhada (sem forçar nova página) —
 * usado logo após o card FAMI, como no modelo de referência.
 */
export function renderDetailedAnalysisOverviewContent(
  doc: OrientaPdfDocument,
  cursor: Cursor,
): Cursor {
  let cur = cursor;

  cur = drawOverviewHeading(
    doc,
    cur,
    "Desempenho do FAMI por eixo",
    "Comparativo dos resultados entre Governança, Social e Ambiental.",
  );

  const axes = orderedAxes(doc);
  const applicableAxes = axes.filter((axis) => axis.maturityLevel != null);

  if (applicableAxes.length >= 3) {
    const blockH = 236;
    cur = doc.ensureBlock(cur, blockH);
    drawFamiRadarChart(doc, cur.page, {
      cx: reportTheme.margin + 128,
      cy: cur.y - 112,
      radius: 86,
      axes: applicableAxes.map((axis) => ({
        axisName: axis.axisName,
        percentage: axis.percentage,
      })),
    });
    let legendY = cur.y - 36;
    const legendX = reportTheme.margin + 286;
    for (const axis of applicableAxes) {
      const theme = reportAxisTheme(axis.axisName);
      cur.page.drawCircle({
        x: legendX + 5,
        y: legendY + 3,
        size: 4,
        color: theme.primary,
      });
      cur.page.drawText(latinPdfSafe(axis.axisName), {
        x: legendX + 16,
        y: legendY,
        size: 11,
        font: doc.fonts.bold,
        color: theme.primary,
      });
      const value = formatReportPercentage(axis.percentage);
      cur.page.drawText(value, {
        x: legendX + 16,
        y: legendY - 15,
        size: 11,
        font: doc.fonts.regular,
        color: reportTheme.slate700,
      });
      legendY -= 42;
    }
    cur = { ...cur, y: cur.y - blockH };
  } else if (applicableAxes.length > 0) {
    cur = drawAxisScoreRows(doc, cur, applicableAxes);
  }

  const hasAnySection = axes.some(
    (axis) => sectionsForAxis(doc.data.fami.sections, axis.axisId).length > 0,
  );
  if (!hasAnySection) return cur;

  cur = drawOverviewHeading(
    doc,
    cur,
    "Desempenho por seção",
    "Percentual, nível e pontuação obtidos em cada seção avaliada.",
  );

  return drawSectionPerformanceTable(doc, cur, axes);
}

/** @deprecated Preferir o fluxo contínuo via renderFamiSummarySection. */
export function renderDetailedAnalysisOverviewSection(doc: OrientaPdfDocument): Cursor {
  const cur = doc.beginMajorSection(
    "Análise detalhada",
    undefined,
    "detailed-analysis",
  );
  return renderDetailedAnalysisOverviewContent(doc, cur);
}
