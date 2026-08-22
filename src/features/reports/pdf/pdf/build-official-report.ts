import type { OfficialReportData } from "@/features/reports/pdf/report-types";
import { prepareDetailedAnalysis } from "@/features/reports/pdf/prepare-detailed-analysis";
import { OrientaPdfDocument } from "./document";
import { renderCoverPage } from "./sections/cover-page";
import { fillTableOfContents } from "./sections/table-of-contents";
import { renderExecutiveSummary } from "./sections/executive-summary";
import { renderFamiSection } from "./sections/fami-section";
import { renderDetailedAxisAnalysisSection } from "./sections/detailed-axis-analysis-section";
import { renderConclusionSection } from "./sections/conclusion-section";
import { renderAnnexesSection } from "./sections/annexes-section";

export const OFFICIAL_REPORT_SECTION_ORDER = [
  "executive_summary",
  "fami",
  "detailed_axis_analysis",
  "conclusion",
  "metadata_audit",
] as const;

type OfficialReportSection = (typeof OFFICIAL_REPORT_SECTION_ORDER)[number];
type SectionRenderer = (doc: OrientaPdfDocument) => void;

/**
 * PDF institucional: capa → sumário → resumo executivo → FAMI →
 * análise detalhada linear por eixo → conclusão → metadados e auditoria.
 */
export async function buildOfficialReportPdfDocument(
  payload: OfficialReportData,
): Promise<Uint8Array> {
  const doc = await OrientaPdfDocument.create(payload);
  const detailedAnalysis = prepareDetailedAnalysis(payload);

  const sectionRenderers: Record<OfficialReportSection, SectionRenderer> = {
    executive_summary: renderExecutiveSummary,
    fami: renderFamiSection,
    detailed_axis_analysis: (pdfDoc) => {
      renderDetailedAxisAnalysisSection(pdfDoc, detailedAnalysis);
    },
    conclusion: renderConclusionSection,
    metadata_audit: renderAnnexesSection,
  };

  renderCoverPage(doc);
  doc.reserveTocPage();

  for (const section of OFFICIAL_REPORT_SECTION_ORDER) {
    sectionRenderers[section](doc);
  }

  fillTableOfContents(doc);
  doc.applyFooters();

  return doc.pdf.save();
}
