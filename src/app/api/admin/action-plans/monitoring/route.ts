import { NextResponse } from "next/server";
import { withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { AdminMonitoringService } from "@/features/improvement-management/monitoring/service";
import { actionPlansCsv } from "@/features/improvement-management/monitoring/csv";
import {
  generateActionPlanExcel,
  getActionPlanExportData,
  toActionPlanExportSourceFromAdmin,
  type ActionPlanExportFormat,
} from "@/features/improvement-management/action-plans/export";
import {
  ACTION_PLAN_BIMONTHLY_EXPORT_AMBIGUOUS_CYCLE,
  ACTION_PLAN_BIMONTHLY_EXPORT_NO_REPORT,
  buildLatestBimonthlyTrackingPdfForCycle,
  resolveActionPlanExportCycleId,
} from "@/features/improvement-management/monitoring/bimonthly/export-pdf";
import { BIMONTHLY_TRACKING_OFFICIAL_FAMI_MISSING } from "@/features/reports/pdf/overlay-bimonthly-tracking";

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

      if (format === "xlsx") {
        const data = getActionPlanExportData(
          result.items
            .map(toActionPlanExportSourceFromAdmin)
            .filter((source) => source != null),
        );
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

      if (format === "pdf") {
        const resolvedCycle = resolveActionPlanExportCycleId(
          query.cycleId,
          result.items.map((item) => item.cycleId),
        );
        if ("error" in resolvedCycle) {
          const message =
            resolvedCycle.error === ACTION_PLAN_BIMONTHLY_EXPORT_AMBIGUOUS_CYCLE
              ? "Selecione um diagnóstico para exportar o relatório bimestral."
              : "Nenhum diagnóstico identificado para exportar o relatório bimestral.";
          return NextResponse.json({ error: message }, { status: 400 });
        }

        try {
          const file = await buildLatestBimonthlyTrackingPdfForCycle(
            createSupabaseServiceRoleClient(),
            resolvedCycle.cycleId,
          );
          return new NextResponse(Buffer.from(file.bytes), {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${file.filename}"`,
              "Cache-Control": "no-store",
            },
          });
        } catch (cause) {
          if (cause instanceof Error) {
            if (cause.message === ACTION_PLAN_BIMONTHLY_EXPORT_NO_REPORT) {
              return NextResponse.json(
                {
                  error:
                    "Nenhum relatório bimestral disponível. Gere o relatório na aba Evolução do Resultado FAMI.",
                },
                { status: 409 },
              );
            }
            if (cause.message === BIMONTHLY_TRACKING_OFFICIAL_FAMI_MISSING) {
              return NextResponse.json(
                { error: "Não existe Resultado FAMI oficial para montar o relatório bimestral." },
                { status: 409 },
              );
            }
          }
          throw cause;
        }
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
