import { FileBarChart, type LucideIcon } from "lucide-react";
import type { ReportCatalogKind } from "@/features/reports/report-catalog";

/**
 * Catálogo de relatórios.
 *
 * A plataforma gera um único documento oficial: o PDF executivo.
 * O tipo e o formato são mantidos como constantes para preservar o
 * contrato de dados (tabela `reports`, histórico e APIs), mas não há
 * mais seleção de variantes na interface.
 */
export type RespondentReportKind = "executive";

export const OFFICIAL_REPORT_KIND: RespondentReportKind = "executive";

export type RespondentReportJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "outdated"
  | "available";

export type ReportKindMeta = {
  id: RespondentReportKind;
  label: string;
  shortDescription: string;
  scope: string;
  icon: LucideIcon;
  pdfSupported: boolean;
};

export const REPORT_KIND_META: Record<RespondentReportKind, ReportKindMeta> = {
  executive: {
    id: "executive",
    label: "Executivo",
    shortDescription: "Resumo para alta gestão: FAMI, maturidade e contagens.",
    scope: "Organização · formulário · última versão de processamento",
    icon: FileBarChart,
    pdfSupported: true,
  },
};



/** Histórico alinhado à tabela `reports` + metadados de UI. */
export type RespondentReportHistoryRow = {
  id: string;
  /** Ciclo canônico que originou a emissão. */
  cycleId: string;
  formId: string;
  formName: string;
  periodLabel: string;
  formTemplateVersion: number | null;
  organizationId: string;
  processingVersion: number;
  policyVersion: string;
  /** Última versão de processamento do mesmo ciclo, calculada no banco. */
  latestProcessingVersion: number;
  /** Versão da emissão do PDF para o mesmo processamento FAMI. */
  emissionVersion: number;
  /** Última emissão do mesmo processamento, calculada no banco. */
  latestEmissionVersion: number;
  /** Verdadeiro somente para a última emissão do último processamento do ciclo. */
  isCurrent: boolean;
  reissueReason: string | null;
  referenceStartYear: number | null;
  referenceEndYear: number | null;
  fileSha256: string | null;
  contentSha256: string | null;
  fileSizeBytes: number | null;
  outdatedReason: string | null;
  generatedBy: string;
  generatedByLabel: string;
  /** Endpoint autenticado que redireciona para URL assinada curta. */
  downloadPath: string;
  generatedAt: string;
  format: "pdf";
  reportKind: RespondentReportKind;
  catalogKind: ReportCatalogKind;
  bimester?: number | null;
  generationKind?: "manual" | "automatic" | null;
  status: "completed";
};

export function defaultReportKindForOfficialPdf(): RespondentReportKind {
  return OFFICIAL_REPORT_KIND;
}
