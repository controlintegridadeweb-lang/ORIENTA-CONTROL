import type { Cursor, OrientaPdfDocument } from "../document";
import { reportTheme } from "../theme";
import { renderEvidencesSubsection } from "./evidences-section";
import { renderEvolutionSubsection } from "./evolution-section";

export function reportPeriodMetadataLines(params: {
  periodLabel: string;
  referencePeriodLabel: string;
}): string[] {
  if (params.periodLabel.trim() === params.referencePeriodLabel.trim()) {
    return [`Período: ${params.referencePeriodLabel}`];
  }

  return [
    `Período: ${params.periodLabel}`,
    `Período de referência: ${params.referencePeriodLabel}`,
  ];
}

export function renderAnnexesSection(doc: OrientaPdfDocument): Cursor {
  let cur = doc.beginMajorSection(
    "Metadados e auditoria da emissão",
    "Identificação técnica, trilha documental, evidências e evolução FAMI quando houver períodos comparáveis.",
    "metadata-audit",
  );

  cur = renderEvidencesSubsection(doc, cur);
  cur = renderEvolutionSubsection(doc, cur);
  cur = doc.drawSubsectionTitle(cur, "Informações técnicas da emissão");

  const items = [
    `Diagnóstico: ${doc.data.formName}`,
    `Organização: ${doc.data.organizationName}`,
    ...reportPeriodMetadataLines({
      periodLabel: doc.data.periodLabel,
      referencePeriodLabel: doc.data.referencePeriodLabel,
    }),
    `Versão do formulário: ${doc.data.actionPlan.formVersion}`,
    `Processamento: ${doc.data.processingVersion}`,
    `Política FAMI: ${doc.data.policyVersion}`,
    `Processado em: ${doc.formatDate(doc.data.famiProcessedAt)}`,
    `Relatório emitido em: ${doc.formatDate(doc.data.generatedAtIso)}`,
    `Identificador documental: ${doc.data.document?.reportId ?? "não disponível"}`,
    `Versão da emissão: ${doc.data.document?.emissionVersion ?? "não disponível"}`,
    `Revisão documentada do plano de ação: ${doc.data.actionPlanRevision}`,
    `Emitido por: ${doc.data.document?.generatedByLabel ?? "Administração da plataforma"}`,
    `Motivo da reemissão: ${doc.data.document?.reissueReason ?? "Primeira emissão"}`,
    `Impressão digital do conteúdo (SHA-256): ${doc.data.document?.contentSha256 ?? "não disponível"}`,
  ];

  for (const item of items) {
    cur = doc.drawParagraph(cur, item, {
      size: 9,
      color: reportTheme.slate600,
      gap: 0,
    });
  }

  return cur;
}
