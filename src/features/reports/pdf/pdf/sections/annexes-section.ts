import type { Cursor, OrientaPdfDocument } from "../document";
import { reportTheme } from "../theme";
import { renderEvidencesSubsection } from "./evidences-section";
import { renderEvolutionSubsection } from "./evolution-section";

export function reportEmissionLines(params: {
  generatedByLabel: string;
  generatedAtLabel: string;
}): string[] {
  return [
    `Emitido por: ${params.generatedByLabel}`,
    `Data e horário: ${params.generatedAtLabel}`,
  ];
}

export function renderAnnexesSection(doc: OrientaPdfDocument): Cursor {
  let cur = doc.beginMajorSection(
    "Emissão",
    "Quem emitiu o relatório, com data e horário.",
    "metadata-audit",
  );

  cur = renderEvidencesSubsection(doc, cur);
  cur = renderEvolutionSubsection(doc, cur);
  cur = doc.drawSubsectionTitle(cur, "Emissão do relatório");

  const items = reportEmissionLines({
    generatedByLabel:
      doc.data.document?.generatedByLabel ?? "Administração da plataforma",
    generatedAtLabel: doc.formatDate(doc.data.generatedAtIso),
  });

  for (const item of items) {
    cur = doc.drawParagraph(cur, item, {
      size: 9,
      color: reportTheme.slate600,
      gap: 0,
    });
  }

  return cur;
}
