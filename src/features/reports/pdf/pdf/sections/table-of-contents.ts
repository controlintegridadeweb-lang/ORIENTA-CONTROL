import { latinPdfSafe } from "@/shared/export/text";

import type { OrientaPdfDocument, TocEntry } from "../document";
import { reportTheme } from "../theme";

/**
 * Página de sumário institucional.
 *
 * Moldura teal contínua + painel branco central, com o título
 * “Sumário” centralizado no topo da área interna — conforme
 * o layout de referência.
 */

export const OFFICIAL_REPORT_TOC_TITLE = "Sumário";

const TOC_LAYOUT = {
  /**
   * Espessura da moldura em todos os lados.
   * Na referência, ~9,4% da largura A4 ≈ 56 pt.
   */
  frame: 56,

  titleSize: 22,

  /**
   * Distância do topo do painel branco até a baseline do título.
   */
  titleBaselineFromInnerTop: 104,

  /**
   * Espaço entre o título e a primeira entrada.
   */
  titleToEntriesGap: 48,

  /**
   * Recuo interno das entradas em relação à borda branca.
   */
  entryInset: 36,

  entrySize: 11,
  nestedEntrySize: 10,
  rowGap: 22,
  nestedRowGap: 18,
} as const;

/**
 * Preenche a página de sumário reservada ao final da montagem.
 */
export function fillTableOfContents(doc: OrientaPdfDocument): void {
  const page = doc.getPage(doc.tocPageIndex);
  const fonts = doc.fonts;
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

  const title = latinPdfSafe(OFFICIAL_REPORT_TOC_TITLE);
  const titleWidth = fonts.bold.widthOfTextAtSize(
    title,
    TOC_LAYOUT.titleSize,
  );
  const innerTop = innerY + innerH;
  const titleBaseline =
    innerTop - TOC_LAYOUT.titleBaselineFromInnerTop;

  page.drawText(title, {
    x: innerX + (innerW - titleWidth) / 2,
    y: titleBaseline,
    size: TOC_LAYOUT.titleSize,
    font: fonts.bold,
    color: reportTheme.slate900,
  });

  const entries: TocEntry[] = doc.tocEntries;
  const listLeft = innerX + TOC_LAYOUT.entryInset;
  const listRight = innerX + innerW - TOC_LAYOUT.entryInset;
  const listWidth = listRight - listLeft;
  const listBottom = innerY + TOC_LAYOUT.entryInset;

  let y = titleBaseline - TOC_LAYOUT.titleToEntriesGap;

  for (const entry of entries) {
    const nested = entry.level > 0;
    const titleSize = nested
      ? TOC_LAYOUT.nestedEntrySize
      : TOC_LAYOUT.entrySize;
    const rowGap = nested
      ? TOC_LAYOUT.nestedRowGap
      : TOC_LAYOUT.rowGap;

    if (y - titleSize < listBottom) {
      break;
    }

    const indent = nested ? 14 * entry.level : 0;
    const entryTitle = latinPdfSafe(entry.title);
    const pageLabel = String(entry.page);
    const titleW = fonts.regular.widthOfTextAtSize(
      entryTitle,
      titleSize,
    );
    const pageW = fonts.bold.widthOfTextAtSize(
      pageLabel,
      titleSize,
    );
    const dotsW = Math.max(
      12,
      listWidth - indent - titleW - pageW - 16,
    );
    const dots = ".".repeat(
      Math.min(Math.floor(dotsW / 4), 80),
    );

    page.drawText(entryTitle, {
      x: listLeft + indent,
      y,
      size: titleSize,
      font: fonts.regular,
      color: nested ? reportTheme.slate600 : reportTheme.slate700,
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

    y -= rowGap;
  }

  if (entries.length === 0) {
    page.drawText("Conteúdo do relatório nas seções a seguir.", {
      x: listLeft,
      y,
      size: 10,
      font: fonts.regular,
      color: reportTheme.slate500,
    });
  }
}
