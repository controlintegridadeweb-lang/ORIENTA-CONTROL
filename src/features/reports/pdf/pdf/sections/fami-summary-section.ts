import { reportLevelLabel } from "@/features/reports/pdf/build-official-report-data";
import { levelMeta } from "@/features/fami";
import { formatReportPercentage } from "../formatters";
import type { Cursor, OrientaPdfDocument } from "../document";
import { contentWidth, reportTheme } from "../theme";
import { drawFamiScoreRing } from "../primitives/score-ring";

/** Resultado geral do FAMI — percentual e nível oficiais, sem recálculo. */
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
  const processedAt = doc.formatDate(doc.data.famiProcessedAt);

  const cardH = 130;
  const card = doc.drawRoundedCard(cur, cardH, {
    fill: reportTheme.brandLight,
    border: reportTheme.slate200,
  });
  const page = card.cursor.page;
  const ringCx = card.innerX + card.innerW - 56;
  const ringCy = card.innerY - 48;
  drawFamiScoreRing(doc, page, {
    cx: ringCx,
    cy: ringCy,
    radius: 42,
    percentage: globalIsNotApplicable ? null : global.percentage,
  });

  page.drawText(levelTitle, {
    x: card.innerX,
    y: card.innerY - 4,
    size: 22,
    font: doc.fonts.bold,
    color: reportTheme.slate900,
  });
  page.drawText(shortLabel, {
    x: card.innerX,
    y: card.innerY - 28,
    size: 13,
    font: doc.fonts.regular,
    color: reportTheme.slate600,
  });
  page.drawText(
    globalIsNotApplicable
      ? "Sem critérios aplicáveis ao FAMI neste diagnóstico."
      : `${formatReportPercentage(global.percentage)} · ${reportLevelLabel(level)}`,
    {
      x: card.innerX,
      y: card.innerY - 52,
      size: 11,
      font: doc.fonts.bold,
      color: reportTheme.brandDark,
      maxWidth: card.innerW - 130,
    },
  );
  page.drawText(`Processamento oficial: ${processedAt}`, {
    x: card.innerX,
    y: card.innerY - 78,
    size: 9,
    font: doc.fonts.regular,
    color: reportTheme.slate500,
    maxWidth: card.innerW - 130,
  });

  cur = { page: card.cursor.page, y: card.cursor.y - 16 };
  cur = doc.drawParagraph(
    cur,
    "O indicador acima reproduz o resultado consolidado do processamento oficial. Não há recálculo no documento.",
    { size: 8.5, color: reportTheme.slate500, gap: 0 },
  );

  // Espaço reservado implícito do anel à direita do card.
  void contentWidth;
  return cur;
}
