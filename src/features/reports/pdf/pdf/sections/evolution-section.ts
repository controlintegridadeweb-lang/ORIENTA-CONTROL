import type { Cursor, OrientaPdfDocument } from "../document";
import { contentWidth, reportTheme } from "../theme";
import { drawSparkline } from "../helpers";

export function hasComparableFamiEvolution(
  points: Array<{ globalPercentage: number | null }>,
): boolean {
  return points.filter((point) => point.globalPercentage != null).length >= 2;
}

/**
 * A evolução só é informativa quando existem pelo menos dois resultados FAMI
 * aplicáveis e comparáveis. Um único ponto não constitui tendência.
 */
export function renderEvolutionSubsection(
  doc: OrientaPdfDocument,
  cursor: Cursor,
): Cursor {
  if (!hasComparableFamiEvolution(doc.data.evolution)) return cursor;
  const comparablePoints = doc.data.evolution.filter(
    (point) => point.globalPercentage != null,
  );

  let cur = doc.drawSubsectionTitle(
    cursor,
    "Evolução do Resultado FAMI",
    "Comparação entre períodos com resultado FAMI aplicável.",
  );

  const sorted = [...comparablePoints].sort(
    (a, b) =>
      a.referenceStartYear - b.referenceStartYear ||
      a.referenceEndYear - b.referenceEndYear ||
      a.processingVersion - b.processingVersion,
  );
  const values = sorted.map((point) => point.globalPercentage!);
  const current = sorted[sorted.length - 1]!;
  const previous = sorted[sorted.length - 2]!;
  const delta = current.globalPercentage! - previous.globalPercentage!;

  const sign = delta >= 0 ? "+" : "";
  const trend = delta > 0 ? "crescimento" : delta < 0 ? "retração" : "estabilidade";
  cur = doc.drawParagraph(
    cur,
    `Variação do período anterior para o atual: ${sign}${delta.toFixed(1)} p.p. (${trend}).`,
    { size: 10, bold: true, gap: 8 },
  );

  cur = doc.ensureBlock(cur, 100);
  cur = drawSparkline(doc, cur, values, contentWidth(), 68);
  cur = { ...cur, y: cur.y - 16 };

  cur = doc.drawSubsectionTitle(cur, "Resultados comparáveis");
  for (const pt of sorted) {
    cur = doc.ensureSpace(cur, 44);
    const pct = `${pt.globalPercentage!.toFixed(1)}%`;
    const lvl = pt.globalMaturityLevel != null ? ` · nível ${pt.globalMaturityLevel}` : "";
    cur.page.drawText(`Período ${pt.referenceLabel}`, {
      x: reportTheme.margin,
      y: cur.y,
      size: 10,
      font: doc.fonts.bold,
      color: reportTheme.slate900,
    });
    cur.page.drawText(`${pct}${lvl}`, {
      x: reportTheme.margin + 210,
      y: cur.y,
      size: 10,
      font: doc.fonts.regular,
      color: reportTheme.slate600,
    });
    cur = { ...cur, y: cur.y - 16 };

    const axisNames = Object.entries(pt.axisPercentages)
      .filter((entry): entry is [string, number] => entry[1] != null)
      .map(([name]) => name);
    if (axisNames.length > 0) {
      const parts = axisNames
        .slice(0, 3)
        .map((name) => `${name}: ${pt.axisPercentages[name]!.toFixed(0)}%`);
      cur = doc.drawParagraph(cur, parts.join(" · "), { size: 8, indent: 8, gap: 2 });
    }
    cur = { ...cur, y: cur.y - 8 };
  }

  return cur;
}
