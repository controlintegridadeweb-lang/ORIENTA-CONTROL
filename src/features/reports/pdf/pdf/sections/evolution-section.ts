import type { Cursor, OrientaPdfDocument } from "../document";
import { contentWidth, reportTheme } from "../theme";
import { drawSparkline } from "../helpers";
import {
  formatPercentagePoints,
  globalPercentagePointDelta,
  isStrictEvolution,
} from "@/features/fami/comparison-policy";

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
  const delta = globalPercentagePointDelta(current.globalPercentage, previous.globalPercentage);
  const strict = isStrictEvolution({
    sameForm: true,
    sameOrganization: true,
    samePolicy: current.policyVersion !== "" && current.policyVersion === previous.policyVersion,
    compatibleBase: current.formVersionId !== "" && current.formVersionId === previous.formVersionId,
  });

  cur = doc.drawParagraph(
    cur,
    delta == null
      ? "A diferença global não é calculada quando um dos percentuais oficiais está ausente."
      : `Diferença global do período anterior para o atual: ${formatPercentagePoints(delta)}.${
          strict
            ? " Mesma política FAMI e mesma versão do formulário."
            : " Sem a mesma política e a mesma versão do formulário, esta diferença não é evolução estrita."
        }`,
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

    const axisParts = [...(pt.axes ?? [])]
      .filter((axis) => axis.percentage != null)
      .sort((left, right) => left.axisId.localeCompare(right.axisId))
      .slice(0, 3)
      .map((axis) => `${axis.axisName}: ${axis.percentage!.toFixed(0)}%`);
    if (axisParts.length > 0) {
      cur = doc.drawParagraph(cur, axisParts.join(" · "), { size: 8, indent: 8, gap: 2 });
    }
    cur = { ...cur, y: cur.y - 8 };
  }

  return cur;
}
