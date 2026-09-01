import type { OfficialReportData } from "@/features/reports/pdf/report-types";
import { prepareDetailedAnalysis } from "@/features/reports/pdf/prepare-detailed-analysis";
import { OrientaPdfDocument } from "./document";
import { renderCoverPage } from "./sections/cover-page";
import { fillTableOfContents } from "./sections/table-of-contents";
import { renderFamiSummarySection } from "./sections/fami-summary-section";
import { renderDiagnosticSummarySection } from "./sections/diagnostic-summary-section";
import { renderDetailedAxisAnalysisSection } from "./sections/detailed-axis-analysis-section";
import { renderConclusionSection } from "./sections/conclusion-section";
import { renderAnnexesSection } from "./sections/annexes-section";

/**
 * Ordem oficial do relatório anual (apresentação).
 * FAMI + análise detalhada (eixos/seções) compartilham a mesma composição inicial.
 * Portfólio, plano e monitoramento ficam aninhados na análise por eixo.
 */
export const OFFICIAL_REPORT_SECTION_ORDER = [
  "fami_summary",
  "diagnostic_summary",
  "detailed_axis_analysis",
  "conclusion",
  "metadata_audit",
] as const;

/** Relatório bimestral do plano: sem Resultado FAMI nem desempenho por eixo/seção. */
export const TRACKING_REPORT_SECTION_ORDER = [
  "diagnostic_summary",
  "detailed_axis_analysis",
  "conclusion",
  "metadata_audit",
] as const;

type OfficialReportSection = (typeof OFFICIAL_REPORT_SECTION_ORDER)[number];
type SectionRenderer = (doc: OrientaPdfDocument) => void;

/**
 * PDF institucional: capa → sumário → (FAMI/análise no anual) → diagnóstico →
 * detalhamento hierárquico por eixo → conclusão → emissão.
 */
export async function buildOfficialReportPdfDocument(
  payload: OfficialReportData,
): Promise<Uint8Array> {
  const doc = await OrientaPdfDocument.create(payload);
  const detailedAnalysis = prepareDetailedAnalysis(payload);
  const sectionOrder = payload.tracking
    ? TRACKING_REPORT_SECTION_ORDER
    : OFFICIAL_REPORT_SECTION_ORDER;

  const sectionRenderers: Record<OfficialReportSection, SectionRenderer> = {
    fami_summary: renderFamiSummarySection,
    diagnostic_summary: renderDiagnosticSummarySection,
    detailed_axis_analysis: (pdfDoc) => {
      renderDetailedAxisAnalysisSection(pdfDoc, detailedAnalysis);
    },
    conclusion: renderConclusionSection,
    metadata_audit: renderAnnexesSection,
  };

  renderCoverPage(doc);
  doc.reserveTocPage();

  for (const section of sectionOrder) {
    sectionRenderers[section](doc);
  }

  fillTableOfContents(doc);
  doc.applyFooters();

  return doc.pdf.save();
}
