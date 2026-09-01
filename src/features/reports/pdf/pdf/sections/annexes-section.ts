import type { Cursor, OrientaPdfDocument } from "../document";
import { reportTheme } from "../theme";
import { renderEvidencesSubsection } from "./evidences-section";
import { renderEvolutionSubsection } from "./evolution-section";

export function reportEmissionLines(params: {
  generatedByLabel: string;
  generatedAtLabel: string;
  trackingDisclaimer?: string;
}): string[] {
  const lines = [
    `Emitido por: ${params.generatedByLabel}`,
    `Data e horário: ${params.generatedAtLabel}`,
  ];
  if (params.trackingDisclaimer) lines.push(params.trackingDisclaimer);
  return lines;
}

export function renderAnnexesSection(doc: OrientaPdfDocument): Cursor {
  let cur = doc.beginMajorSection(
    "Emissão",
    "Quem emitiu o relatório, com data e horário.",
    "metadata-audit",
  );

  cur = renderEvidencesSubsection(doc, cur);
  if (!doc.data.tracking) {
    cur = renderEvolutionSubsection(doc, cur);
  }
  cur = doc.drawSubsectionTitle(cur, "Emissão do relatório");

  const items = reportEmissionLines({
    generatedByLabel:
      doc.data.document?.generatedByLabel ?? "Administração da plataforma",
    generatedAtLabel: doc.formatDate(doc.data.generatedAtIso),
    trackingDisclaimer: doc.data.tracking?.disclaimer,
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
