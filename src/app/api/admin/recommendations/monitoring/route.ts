import { NextResponse } from "next/server";
import { withRoute } from "@/infrastructure/api/with-route";
import { AdminMonitoringService } from "@/features/improvement-management/monitoring/service";
import {
  buildRecommendationPortfolioCsv,
  buildRecommendationPortfolioExportRows,
  buildRecommendationPortfolioPdf,
  buildRecommendationPortfolioXlsx,
  toPortfolioExportSourceFromAdmin,
  type RecommendationPortfolioExportFormat,
} from "@/features/improvement-management/recommendations/export";

function parseExportFormat(raw: string | undefined): RecommendationPortfolioExportFormat {
  if (raw === "xlsx" || raw === "pdf" || raw === "csv") return raw;
  return "csv";
}

export const GET = withRoute(
  {
    roles: ["admin"],
    route: "/api/admin/recommendations/monitoring",
    logMessage: "Failed to load recommendation monitoring",
  },
  async ({ request }) => {
    const query = Object.fromEntries(new URL(request.url).searchParams.entries());
    const result = await new AdminMonitoringService().listRecommendations(query);
    if (query.export === "true") {
      const rows = buildRecommendationPortfolioExportRows(
        result.items.map(toPortfolioExportSourceFromAdmin),
      );
      const format = parseExportFormat(query.format);

      if (format === "xlsx") {
        const file = await buildRecommendationPortfolioXlsx(rows);
        return new NextResponse(new Uint8Array(file.content), {
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${file.filename}"`,
            "Cache-Control": "no-store",
          },
        });
      }

      if (format === "pdf") {
        const file = await buildRecommendationPortfolioPdf(rows);
        return new NextResponse(Buffer.from(file.content), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${file.filename}"`,
            "Cache-Control": "no-store",
          },
        });
      }

      const csv = buildRecommendationPortfolioCsv(rows, "portfolio-recomendacoes");
      return new NextResponse(csv.content, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${csv.filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }
    return NextResponse.json(result);
  },
);
