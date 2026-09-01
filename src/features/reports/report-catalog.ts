import {
  reportCatalogLabels,
  reportDocumentTitles,
} from "@/shared/labels/official-labels";

export const REPORT_CATALOG_KINDS = ["annual", "bimonthly"] as const;
export type ReportCatalogKind = (typeof REPORT_CATALOG_KINDS)[number];

export function catalogDownloadPath(kind: ReportCatalogKind, id: string): string {
  return kind === "bimonthly"
    ? `/api/monitoring/bimonthly/${id}/export?format=pdf`
    : `/api/reports/${id}/download`;
}

export function catalogKindLabel(kind: ReportCatalogKind, year?: number | null): string {
  if (kind === "bimonthly") return reportCatalogLabels.bimonthly;
  return year != null ? reportDocumentTitles.annual(year) : reportCatalogLabels.annual;
}
