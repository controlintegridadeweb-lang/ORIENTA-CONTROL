import { NextResponse } from "next/server";
import { withRoute } from "@/infrastructure/api/with-route";
import { AdminMonitoringService } from "@/features/improvement-management/monitoring/service";
import { actionPlansCsv } from "@/features/improvement-management/monitoring/csv";
import {
  generateActionPlanExcel,
  generateActionPlanPdf,
  getActionPlanExportData,
  toActionPlanExportSourceFromAdmin,
  type ActionPlanExportFormat,
} from "@/features/improvement-management/action-plans/export";

function parseExportFormat(
  raw: string | undefined,
): ActionPlanExportFormat | "csv" {
  if (raw === "xlsx" || raw === "pdf" || raw === "csv") return raw;
  return "csv";
}

export const GET = withRoute(
  {
    roles: ["admin"],
    route: "/api/admin/action-plans/monitoring",
    logMessage: "Failed to load action plan monitoring",
  },
  async ({ request }) => {
    const query = Object.fromEntries(new URL(request.url).searchParams.entries());
    const result = await new AdminMonitoringService().listActionPlans(query);
    if (query.export === "true") {
      const format = parseExportFormat(query.format);

      if (format === "xlsx" || format === "pdf") {
        const data = getActionPlanExportData(
          result.items
            .map(toActionPlanExportSourceFromAdmin)
            .filter((source) => source != null),
        );

        if (format === "xlsx") {
          const file = await generateActionPlanExcel(data);
          return new NextResponse(new Uint8Array(file.content), {
            headers: {
              "Content-Type":
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "Content-Disposition": `attachment; filename="${file.filename}"`,
              "Cache-Control": "no-store",
            },
          });
        }

        const file = await generateActionPlanPdf(data);
        return new NextResponse(Buffer.from(file.content), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${file.filename}"`,
            "Cache-Control": "no-store",
          },
        });
      }

      const csv = actionPlansCsv(result.items);
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
