import { formatPlatformDate } from "@/shared/datetime/platform-date-time";
/**
 * Capa institucional — apenas identificação executiva do relatório.
 * Metadados técnicos ficam concentrados no anexo de auditoria.
 */

import type { PDFPage } from "pdf-lib";
import { levelMeta } from "@/features/fami";
import type { OfficialReportData } from "@/features/reports/pdf/report-types";
import type { OrientaPdfDocument, ReportFonts } from "../document";
import { reportTheme } from "../theme";
import { drawCoverGeometricPanel } from "./cover-geometric-panel";


export const OFFICIAL_REPORT_COVER_FIELD_LABELS = [
  "Formulário",
  "Organização",
  "Resultado FAMI",
  "Data da emissão",
] as const;

type CoverPageProps = {
  organizationName: string;
  formName: string;
  famiResultLabel: string;
  generatedAt: string;
  referencePeriodLabel: string;
};

function buildCoverPageProps(data: OfficialReportData): CoverPageProps {
  const lvl = data.fami.global.maturityLevel;
  const meta = lvl == null ? null : levelMeta(lvl);
  const levelLabel = lvl == null ? "N/A — sem pergunta aplicável" : `N${lvl} — ${meta!.shortLabel}`;
  const percentageLabel = lvl == null ? "N/A" : `${data.fami.global.percentage.toFixed(1)}%`;

  return {
    organizationName: data.organizationName,
    formName: data.formName,
    famiResultLabel: lvl == null ? levelLabel : `${percentageLabel} · ${levelLabel}`,
    generatedAt: formatPlatformDate(data.generatedAtIso, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    referencePeriodLabel: data.referencePeriodLabel,
  };
}

const LEFT_X: number = reportTheme.margin;
const TEXT_W = reportTheme.page.w * 0.56 - reportTheme.margin;

type FieldRow = { label: string; value: string };

function wrapLines(
  fonts: ReportFonts,
  text: string,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (fonts.regular.widthOfTextAtSize(next, size) <= maxWidth) current = next;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawSeal(page: PDFPage, fonts: ReportFonts, x: number, topY: number): void {
  const w = 112;
  const h = 26;
  page.drawRectangle({
    x,
    y: topY - h,
    width: w,
    height: h,
    borderColor: reportTheme.coverGeoDark,
    borderWidth: 0.6,
    color: reportTheme.white,
  });
  page.drawText("DOCUMENTO OFICIAL", {
    x: x + 8,
    y: topY - h + 8,
    size: 6.5,
    font: fonts.bold,
    color: reportTheme.coverGeoDark,
  });
}

function drawField(
  page: PDFPage,
  fonts: ReportFonts,
  x: number,
  y: number,
  field: FieldRow,
  valueMaxW: number,
): number {
  page.drawText(field.label.toUpperCase(), {
    x,
    y,
    size: 8,
    font: fonts.bold,
    color: reportTheme.coverInk,
  });
  let cy = y - 14;
  for (const line of wrapLines(fonts, field.value, 10, valueMaxW)) {
    page.drawText(line, {
      x,
      y: cy,
      size: 10,
      font: fonts.regular,
      color: reportTheme.coverInkMuted,
    });
    cy -= 13;
  }
  return cy - 18;
}

function renderCoverPageContent(
  doc: OrientaPdfDocument,
  page: PDFPage,
  props: CoverPageProps,
): void {
  const fonts = doc.fonts;
  const H = reportTheme.page.h;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: reportTheme.page.w,
    height: H,
    color: reportTheme.coverBg,
  });
  drawCoverGeometricPanel(page);

  const topY = H - reportTheme.margin;

  if (doc.logo) {
    const logoH = 30;
    const logoW = (doc.logo.width / doc.logo.height) * logoH;
    page.drawImage(doc.logo, {
      x: LEFT_X,
      y: topY - logoH,
      width: logoW,
      height: logoH,
    });
    drawSeal(page, fonts, LEFT_X + logoW + 14, topY);
  } else {
    page.drawText("Plataforma Orienta", {
      x: LEFT_X,
      y: topY - 20,
      size: 13,
      font: fonts.bold,
      color: reportTheme.coverGeoDark,
    });
    drawSeal(page, fonts, LEFT_X + 210, topY);
  }

  const titleBlockY = H * 0.55;
  page.drawText("PERÍODO DE REFERÊNCIA", {
    x: LEFT_X,
    y: titleBlockY,
    size: 10,
    font: fonts.bold,
    color: reportTheme.coverInk,
  });
  page.drawText(props.referencePeriodLabel, {
    x: LEFT_X,
    y: titleBlockY - 26,
    size: 30,
    font: fonts.bold,
    color: reportTheme.coverInk,
  });
  page.drawText("RELATÓRIO", {
    x: LEFT_X,
    y: titleBlockY - 92,
    size: 44,
    font: fonts.bold,
    color: reportTheme.coverInk,
  });

  const fields: FieldRow[] = [
    { label: OFFICIAL_REPORT_COVER_FIELD_LABELS[0], value: props.formName },
    { label: OFFICIAL_REPORT_COVER_FIELD_LABELS[1], value: props.organizationName },
    { label: OFFICIAL_REPORT_COVER_FIELD_LABELS[2], value: props.famiResultLabel },
    { label: OFFICIAL_REPORT_COVER_FIELD_LABELS[3], value: props.generatedAt },
  ];

  const colGap = 32;
  const colW = (TEXT_W - colGap) / 2;
  const fieldsTop = H * 0.34;
  let leftY = fieldsTop;
  let rightY = fieldsTop;

  const leftColumnSize = 2;
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]!;
    if (i < leftColumnSize) leftY = drawField(page, fonts, LEFT_X, leftY, field, colW);
    else rightY = drawField(page, fonts, LEFT_X + colW + colGap, rightY, field, colW);
  }
}

export function renderCoverPage(doc: OrientaPdfDocument): void {
  const c = doc.newPage();
  renderCoverPageContent(doc, c.page, buildCoverPageProps(doc.data));
}
