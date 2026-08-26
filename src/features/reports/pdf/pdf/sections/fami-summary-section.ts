import { levelMeta } from "@/features/fami";
import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import { latinPdfSafe } from "@/shared/export/text";
import type { Cursor, OrientaPdfDocument } from "../document";
import { reportTheme } from "../theme";
import { drawFilledPill } from "../helpers";
import {
  drawFamiScoreRing,
  FAMI_SCORE_RING_STROKE,
} from "../primitives/score-ring";
import { renderDetailedAnalysisOverviewContent } from "./detailed-analysis-overview-section";

/** Resultado geral do FAMI + análise detalhada na mesma composição (modelo de referência). */
export function renderFamiSummarySection(doc: OrientaPdfDocument): Cursor {
  let cur = doc.beginMajorSection(
    "Resultado geral do FAMI",
    "Percentual e nível oficiais do processamento selecionado.",
    "fami-summary",
  );

  const global = doc.data.fami.global;
  const globalIsNotApplicable = global.maturityLevel == null;
  const level = global.maturityLevel;
  const shortLabel =
    level == null ? "Sem classificação" : levelMeta(level).shortLabel;
  const levelTitle = level == null ? "N/A" : `Nível ${level}`;
  const updatedAt = formatPlatformDateTime(
    doc.data.famiProcessedAt,
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
    doc.formatDate(doc.data.famiProcessedAt),
  );

  const badgeLabel = latinPdfSafe(levelTitle);
  const badgeSize = 9;
  const badgePadX = 8;
  const badgeH = 16;
  const badgeW =
    doc.fonts.bold.widthOfTextAtSize(badgeLabel, badgeSize) + badgePadX * 2;
  const titleSize = 16;
  const dateSize = 8;
  const stackGap = 6;
  const naNote = globalIsNotApplicable;

  const titleAscent = doc.fonts.bold.heightAtSize(titleSize, { descender: false });
  const dateAscent = doc.fonts.italic.heightAtSize(dateSize, { descender: false });
  const dateDesc =
    doc.fonts.italic.heightAtSize(dateSize) - dateAscent;
  const naAscent = naNote
    ? doc.fonts.regular.heightAtSize(9, { descender: false })
    : 0;
  const stackH =
    badgeH +
    stackGap +
    titleAscent +
    stackGap +
    dateAscent +
    dateDesc +
    (naNote ? stackGap + naAscent : 0);

  const ringRadius = 34;
  const ringOuter = ringRadius + FAMI_SCORE_RING_STROKE / 2;
  const rowH = Math.max(stackH, ringOuter * 2);
  const cardH = rowH + 32;
  const card = doc.drawRoundedCard(cur, cardH, {
    fill: reportTheme.white,
    border: reportTheme.slate200,
  });
  const page = card.cursor.page;
  const midY = card.midY;
  const ringCx = card.innerX + card.innerW - ringOuter;
  const textMaxW = ringCx - ringOuter - card.innerX - 16;

  drawFamiScoreRing(doc, page, {
    cx: ringCx,
    cy: midY,
    radius: ringRadius,
    percentage: globalIsNotApplicable ? null : global.percentage,
  });

  let y = midY + stackH / 2;
  const badgeBottom = y - badgeH;
  const badgeAscent = doc.fonts.bold.heightAtSize(badgeSize, { descender: false });
  drawFilledPill(page, card.innerX, badgeBottom, badgeW, badgeH, reportTheme.brandBadge);
  page.drawText(badgeLabel, {
    x: card.innerX + badgePadX,
    y: badgeBottom + (badgeH - badgeAscent) / 2,
    size: badgeSize,
    font: doc.fonts.bold,
    color: reportTheme.white,
  });

  y = badgeBottom - stackGap;
  const titleBaseline = y - titleAscent;
  page.drawText(latinPdfSafe(shortLabel), {
    x: card.innerX,
    y: titleBaseline,
    size: titleSize,
    font: doc.fonts.bold,
    color: reportTheme.slate900,
  });

  y = titleBaseline - stackGap;
  const dateBaseline = y - dateAscent;
  page.drawText(latinPdfSafe(`Atualizado: ${updatedAt}`), {
    x: card.innerX,
    y: dateBaseline,
    size: dateSize,
    font: doc.fonts.italic,
    color: reportTheme.slate500,
    maxWidth: textMaxW,
  });
  if (naNote) {
    page.drawText("Sem critérios aplicáveis ao FAMI neste diagnóstico.", {
      x: card.innerX,
      y: dateBaseline - dateDesc - stackGap - naAscent,
      size: 9,
      font: doc.fonts.regular,
      color: reportTheme.slate600,
      maxWidth: textMaxW,
    });
  }

  cur = { page: card.cursor.page, y: card.cursor.y - 20 };

  doc.registerTocEntry("detailed-analysis", "Análise detalhada");
  cur = doc.drawSectionTitle(cur, "Análise detalhada");
  cur = renderDetailedAnalysisOverviewContent(doc, cur);
  return cur;
}
