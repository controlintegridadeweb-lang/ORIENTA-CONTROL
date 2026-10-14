import type { PDFPage } from "pdf-lib";
import { latinPdfSafe } from "@/shared/export/text";
import { reportTheme } from "@/shared/export/official-pdf-theme";
import type { ReportFonts } from "@/shared/export/official-pdf-types";

export const OFFICIAL_TOC_TITLE = "Sumário";

export type OfficialTocEntry = {
  title: string;
  page: number;
  /** 0 = entrada principal; valores maiores recuam a linha. */
  level: number;
};

const TOC_LAYOUT = {
  frame: 56,
  titleSize: 22,
  titleBaselineFromInnerTop: 104,
  titleToEntriesGap: 48,
  entryInset: 36,
  entrySize: 11,
  nestedEntrySize: 10,
  rowGap: 22,
  nestedRowGap: 18,
} as const;

function entryMetrics(level: number): { titleSize: number; rowGap: number } {
  const nested = level > 0;
  return {
    titleSize: nested ? TOC_LAYOUT.nestedEntrySize : TOC_LAYOUT.entrySize,
    rowGap: nested ? TOC_LAYOUT.nestedRowGap : TOC_LAYOUT.rowGap,
  };
}

function listOrigin(): { firstY: number; listBottom: number } {
  const { h: pageHeight } = reportTheme.page;
  const frame = TOC_LAYOUT.frame;
  const innerH = pageHeight - frame * 2;
  const innerTop = frame + innerH;
  const titleBaseline = innerTop - TOC_LAYOUT.titleBaselineFromInnerTop;
  return {
    firstY: titleBaseline - TOC_LAYOUT.titleToEntriesGap,
    listBottom: frame + TOC_LAYOUT.entryInset,
  };
}

/** Divide as entradas nas páginas que a moldura institucional comporta. */
export function paginateOfficialToc<T extends { level: number }>(
  entries: readonly T[],
): T[][] {
  if (entries.length === 0) return [[]];
  const { firstY, listBottom } = listOrigin();
  const pages: T[][] = [[]];
  let y = firstY;
  for (const entry of entries) {
    const { titleSize, rowGap } = entryMetrics(entry.level);
    if (y - titleSize < listBottom) {
      pages.push([]);
      y = firstY;
    }
    pages[pages.length - 1]!.push(entry);
    y -= rowGap;
  }
  return pages;
}

function drawFrame(page: PDFPage, fonts: ReportFonts): {
  listLeft: number;
  listRight: number;
  listWidth: number;
  firstY: number;
  listBottom: number;
} {
  const { w: pageWidth, h: pageHeight } = reportTheme.page;
  const frame = TOC_LAYOUT.frame;
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: reportTheme.tocFrame,
  });
  const innerX = frame;
  const innerY = frame;
  const innerW = pageWidth - frame * 2;
  const innerH = pageHeight - frame * 2;
  page.drawRectangle({
    x: innerX,
    y: innerY,
    width: innerW,
    height: innerH,
    color: reportTheme.white,
  });

  const title = latinPdfSafe(OFFICIAL_TOC_TITLE);
  const titleWidth = fonts.bold.widthOfTextAtSize(title, TOC_LAYOUT.titleSize);
  const innerTop = innerY + innerH;
  const titleBaseline = innerTop - TOC_LAYOUT.titleBaselineFromInnerTop;
  page.drawText(title, {
    x: innerX + (innerW - titleWidth) / 2,
    y: titleBaseline,
    size: TOC_LAYOUT.titleSize,
    font: fonts.bold,
    color: reportTheme.slate900,
  });

  const listLeft = innerX + TOC_LAYOUT.entryInset;
  const listRight = innerX + innerW - TOC_LAYOUT.entryInset;
  const { firstY, listBottom } = listOrigin();
  return { listLeft, listRight, listWidth: listRight - listLeft, firstY, listBottom };
}

function drawEntry(
  page: PDFPage,
  fonts: ReportFonts,
  entry: OfficialTocEntry,
  y: number,
  listLeft: number,
  listRight: number,
  listWidth: number,
): void {
  const { titleSize } = entryMetrics(entry.level);
  const indent = entry.level > 0 ? 14 * entry.level : 0;
  const pageLabel = String(entry.page);
  const pageW = fonts.bold.widthOfTextAtSize(pageLabel, titleSize);
  const titleBudget = Math.max(24, listWidth - indent - pageW - 28);
  let entryTitle = latinPdfSafe(entry.title);
  if (fonts.regular.widthOfTextAtSize(entryTitle, titleSize) > titleBudget) {
    while (
      entryTitle.length > 1 &&
      fonts.regular.widthOfTextAtSize(`${entryTitle}...`, titleSize) > titleBudget
    ) {
      entryTitle = entryTitle.slice(0, -1);
    }
    entryTitle = `${entryTitle.trimEnd()}...`;
  }
  const titleW = fonts.regular.widthOfTextAtSize(entryTitle, titleSize);
  const dotsW = Math.max(12, listWidth - indent - titleW - pageW - 16);
  const dots = ".".repeat(Math.min(Math.floor(dotsW / 4), 80));

  page.drawText(entryTitle, {
    x: listLeft + indent,
    y,
    size: titleSize,
    font: fonts.regular,
    color: entry.level > 0 ? reportTheme.slate600 : reportTheme.slate700,
  });
  page.drawText(dots, {
    x: listLeft + indent + titleW + 6,
    y,
    size: titleSize,
    font: fonts.regular,
    color: reportTheme.slate200,
  });
  page.drawText(pageLabel, {
    x: listRight - pageW,
    y,
    size: titleSize,
    font: fonts.bold,
    color: reportTheme.brandDark,
  });
}

/** Preenche as páginas de sumário já reservadas, com o número de cada entrada. */
export function drawOfficialTableOfContents(
  pages: readonly PDFPage[],
  fonts: ReportFonts,
  entries: readonly OfficialTocEntry[],
): void {
  const chunks = paginateOfficialToc(entries);
  pages.forEach((page, index) => {
    const frame = drawFrame(page, fonts);
    const chunk = chunks[index] ?? [];
    if (chunk.length === 0 && index === 0) {
      page.drawText("Conteúdo do relatório nas seções a seguir.", {
        x: frame.listLeft,
        y: frame.firstY,
        size: 10,
        font: fonts.regular,
        color: reportTheme.slate500,
      });
      return;
    }
    let y = frame.firstY;
    for (const entry of chunk) {
      const { rowGap } = entryMetrics(entry.level);
      drawEntry(page, fonts, entry, y, frame.listLeft, frame.listRight, frame.listWidth);
      y -= rowGap;
    }
  });
}
