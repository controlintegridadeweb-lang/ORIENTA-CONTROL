import {
  drawOfficialTableOfContents,
  OFFICIAL_TOC_TITLE,
} from "@/shared/export/official-pdf-toc";

import type { OrientaPdfDocument } from "../document";

export const OFFICIAL_REPORT_TOC_TITLE = OFFICIAL_TOC_TITLE;

/** Preenche a página de sumário reservada ao final da montagem. */
export function fillTableOfContents(doc: OrientaPdfDocument): void {
  drawOfficialTableOfContents(
    [doc.getPage(doc.tocPageIndex)],
    doc.fonts,
    doc.tocEntries,
  );
}
