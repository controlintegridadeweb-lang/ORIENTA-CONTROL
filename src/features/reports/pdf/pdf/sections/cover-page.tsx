import { formatPlatformDate } from "@/shared/datetime/platform-date-time";
import { latinPdfSafe } from "@/shared/export/text";
/**
 * Capa institucional — marca ORIENTA, decoração geométrica e identificação executiva.
 */

import type { PDFImage, PDFPage } from "pdf-lib";
import { levelMeta } from "@/features/fami";
import type { OfficialReportData } from "@/features/reports/pdf/report-types";
import { formatReportPercentage } from "../formatters";
import type { OrientaPdfDocument, ReportFonts } from "../document";
import { reportTheme } from "../theme";

export const OFFICIAL_REPORT_COVER_FIELD_LABELS = [
  "Período de referência",
  "Formulário",
  "Resultado FAMI",
  "Organização",
  "Data de emissão",
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
  const levelLabel =
    lvl == null
      ? "N/A — sem pergunta aplicável"
      : `Nível ${lvl} — ${meta!.shortLabel}`;
  const percentageLabel =
    lvl == null ? "N/A" : formatReportPercentage(data.fami.global.percentage);

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

function drawCornerImage(
  page: PDFPage,
  image: PDFImage,
  opts: { anchor: "top-left" | "bottom-right"; maxW: number; maxH: number },
): void {
  const { w: W, h: H } = reportTheme.page;
  const scale = Math.min(opts.maxW / image.width, opts.maxH / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  if (opts.anchor === "top-left") {
    page.drawImage(image, { x: 0, y: H - height, width, height });
    return;
  }
  page.drawImage(image, { x: W - width, y: 0, width, height });
}

function measureFieldHeight(
  fonts: ReportFonts,
  value: string,
  maxW: number,
): number {
  const lines = Math.max(1, wrapLines(fonts, latinPdfSafe(value), 11, maxW).length);
  return 12 + lines * 14 + 8;
}

function drawField(
  page: PDFPage,
  fonts: ReportFonts,
  x: number,
  topY: number,
  label: string,
  value: string,
  maxW: number,
): void {
  page.drawText(latinPdfSafe(label.toUpperCase()), {
    x,
    y: topY,
    size: 7.5,
    font: fonts.bold,
    color: reportTheme.coverInkMuted,
  });
  let cy = topY - 14;
  for (const line of wrapLines(fonts, latinPdfSafe(value), 11, maxW)) {
    page.drawText(line, {
      x,
      y: cy,
      size: 11,
      font: fonts.bold,
      color: reportTheme.coverInk,
    });
    cy -= 14;
  }
}

function renderCoverPageContent(
  doc: OrientaPdfDocument,
  page: PDFPage,
  props: CoverPageProps,
): void {
  const fonts = doc.fonts;
  const { w: W, h: H } = reportTheme.page;
  const margin = 56;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: W,
    height: H,
    color: reportTheme.white,
  });

  const { brandMark, decoTop, decoBottom } = doc.coverAssets;

  if (decoTop) {
    drawCornerImage(page, decoTop, {
      anchor: "top-left",
      maxW: 168,
      maxH: 168,
    });
  }
  if (decoBottom) {
    drawCornerImage(page, decoBottom, {
      anchor: "bottom-right",
      maxW: 176,
      maxH: 176,
    });
  }

  // Marca: centro visual da metade superior.
  const brandCenterY = H * 0.62;
  if (brandMark) {
    const maxW = 340;
    const maxH = 100;
    const scale = Math.min(maxW / brandMark.width, maxH / brandMark.height);
    const bw = brandMark.width * scale;
    const bh = brandMark.height * scale;
    page.drawImage(brandMark, {
      x: (W - bw) / 2,
      y: brandCenterY - bh / 2,
      width: bw,
      height: bh,
    });
  } else if (doc.logo) {
    const logoH = 40;
    const logoW = (doc.logo.width / doc.logo.height) * logoH;
    page.drawImage(doc.logo, {
      x: (W - logoW) / 2,
      y: brandCenterY,
      width: logoW,
      height: logoH,
    });
    page.drawText("Relatório oficial", {
      x: (W - fonts.regular.widthOfTextAtSize("Relatório oficial", 13)) / 2,
      y: brandCenterY - 28,
      size: 13,
      font: fonts.regular,
      color: reportTheme.coverInk,
    });
  } else {
    page.drawText("orienta", {
      x: (W - fonts.bold.widthOfTextAtSize("orienta", 34)) / 2,
      y: brandCenterY + 8,
      size: 34,
      font: fonts.bold,
      color: reportTheme.coverInk,
    });
    page.drawText("Relatório oficial", {
      x: (W - fonts.regular.widthOfTextAtSize("Relatório oficial", 13)) / 2,
      y: brandCenterY - 20,
      size: 13,
      font: fonts.regular,
      color: reportTheme.coverInk,
    });
  }

  // Bloco de dados: grade 2 colunas com linhas alinhadas (sem zigzag).
  const gap = 36;
  const colW = (W - margin * 2 - gap) / 2;
  const leftX = margin;
  const rightX = margin + colW + gap;

  const rows: Array<{
    left: { label: string; value: string } | null;
    right: { label: string; value: string } | null;
  }> = [
    {
      left: {
        label: OFFICIAL_REPORT_COVER_FIELD_LABELS[0],
        value: props.referencePeriodLabel,
      },
      right: {
        label: OFFICIAL_REPORT_COVER_FIELD_LABELS[1],
        value: props.formName,
      },
    },
    {
      left: {
        label: OFFICIAL_REPORT_COVER_FIELD_LABELS[2],
        value: props.famiResultLabel,
      },
      right: {
        label: OFFICIAL_REPORT_COVER_FIELD_LABELS[3],
        value: props.organizationName,
      },
    },
    {
      left: {
        label: OFFICIAL_REPORT_COVER_FIELD_LABELS[4],
        value: props.generatedAt,
      },
      right: null,
    },
  ];

  const rowHeights = rows.map((row) => {
    const leftH = row.left
      ? measureFieldHeight(fonts, row.left.value, colW)
      : 0;
    const rightH = row.right
      ? measureFieldHeight(fonts, row.right.value, colW)
      : 0;
    return Math.max(leftH, rightH, 36);
  });
  const blockH = rowHeights.reduce((sum, height) => sum + height, 0);
  let y = Math.min(H * 0.38, brandCenterY - 90) - 8;

  // Linha discreta separando marca e dados.
  page.drawLine({
    start: { x: margin, y: y + 18 },
    end: { x: W - margin, y: y + 18 },
    thickness: 0.6,
    color: reportTheme.slate200,
  });

  // Garante que o bloco não invade a decoração inferior.
  const minBottom = 120;
  if (y - blockH < minBottom) {
    y = minBottom + blockH;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.left) {
      drawField(page, fonts, leftX, y, row.left.label, row.left.value, colW);
    }
    if (row.right) {
      drawField(page, fonts, rightX, y, row.right.label, row.right.value, colW);
    }
    y -= rowHeights[i]!;
  }
}

export function renderCoverPage(doc: OrientaPdfDocument): void {
  const c = doc.newPage();
  renderCoverPageContent(doc, c.page, buildCoverPageProps(doc.data));
}
