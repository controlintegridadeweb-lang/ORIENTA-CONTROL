import type { OrientaPdfDocument, TocEntry } from "../document";
import { contentWidth, reportTheme } from "../theme";

/** Preenche a página de sumário reservada ao final da montagem. */
export function fillTableOfContents(doc: OrientaPdfDocument): void {
  const page = doc.getPage(doc.tocPageIndex);
  const fonts = doc.fonts;
  const top = doc.contentTop;

  page.drawText("Sumário", {
    x: reportTheme.margin,
    y: top - 4,
    size: 20,
    font: fonts.bold,
    color: reportTheme.slate900,
  });

  let y = top - 40;
  page.drawLine({
    start: { x: reportTheme.margin, y: y + 8 },
    end: { x: reportTheme.page.w - reportTheme.margin, y: y + 8 },
    thickness: 0.75,
    color: reportTheme.slate200,
  });
  y -= 24;

  const entries: TocEntry[] = doc.tocEntries;
  const w = contentWidth();

  for (const entry of entries) {
    const indent = entry.level > 0 ? 14 * entry.level : 0;
    const title = entry.title;
    const pageLabel = String(entry.page);
    const titleSize = entry.level > 0 ? 10 : 11;
    const titleW = fonts.regular.widthOfTextAtSize(title, titleSize);
    const pageW = fonts.bold.widthOfTextAtSize(pageLabel, titleSize);
    const dotsW = Math.max(12, w - indent - titleW - pageW - 16);
    const dotCount = Math.floor(dotsW / 4);
    const dots = ".".repeat(Math.min(dotCount, 80));

    page.drawText(title, {
      x: reportTheme.margin + indent,
      y,
      size: titleSize,
      font: fonts.regular,
      color: entry.level > 0 ? reportTheme.slate600 : reportTheme.slate700,
    });
    page.drawText(dots, {
      x: reportTheme.margin + indent + titleW + 6,
      y,
      size: titleSize,
      font: fonts.regular,
      color: reportTheme.slate200,
    });
    page.drawText(pageLabel, {
      x: reportTheme.page.w - reportTheme.margin - pageW,
      y,
      size: titleSize,
      font: fonts.bold,
      color: reportTheme.brandDark,
    });
    y -= entry.level > 0 ? 18 : 22;
  }

  if (entries.length === 0) {
    page.drawText("Conteúdo do relatório nas seções a seguir.", {
      x: reportTheme.margin,
      y,
      size: 10,
      font: fonts.regular,
      color: reportTheme.slate500,
    });
  }
}
