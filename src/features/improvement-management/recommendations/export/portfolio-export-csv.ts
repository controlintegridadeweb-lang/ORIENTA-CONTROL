import { businessToday } from "@/shared/datetime/business-date";
import { formatPlatformDate, formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import { createCsvContent } from "@/shared/export/csv";
import type { RecommendationPortfolioExportRow } from "./portfolio-export-types";
import { RECOMMENDATION_PORTFOLIO_EXPORT_HEADERS } from "./portfolio-export-types";

function formatDeadline(value: Date | null): string {
  if (!value) return "";
  return formatPlatformDate(value, { day: "2-digit", month: "2-digit", year: "numeric" }, "");
}

function formatUpdatedAt(value: Date | null): string {
  if (!value) return "";
  return formatPlatformDateTime(
    value,
    { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" },
    "",
  );
}

/** Células CSV na ordem canônica dos cabeçalhos. */
export function portfolioExportRowToCsvCells(
  row: RecommendationPortfolioExportRow,
): unknown[] {
  return [
    row.formName,
    row.formVersion ?? "",
    row.period,
    row.organizationName,
    row.axisName,
    row.sectionName,
    row.questionText,
    row.recommendationText,
    row.recommendationStatus,
    row.actionTitle ?? "",
    row.responsibleName ?? "",
    formatDeadline(row.startDate),
    formatDeadline(row.endDate),
    row.actionStatus ?? "",
    row.progressPercent == null ? "" : row.progressPercent,
    formatUpdatedAt(row.updatedAt),
  ];
}

export function buildRecommendationPortfolioCsv(
  rows: readonly RecommendationPortfolioExportRow[],
  fileBaseName = "portfolio-recomendacoes",
): { filename: string; content: string } {
  const table = [
    [...RECOMMENDATION_PORTFOLIO_EXPORT_HEADERS],
    ...rows.map(portfolioExportRowToCsvCells),
  ];
  return {
    filename: `${fileBaseName}-${businessToday()}.csv`,
    content: createCsvContent(table),
  };
}
