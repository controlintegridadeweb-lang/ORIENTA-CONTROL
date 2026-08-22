import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { FormsAnswersService } from "@/features/forms/answers-service";
import { parseAnswersListFilters } from "@/features/forms/answers-http";
import { buildAnswersCsv, buildAnswersPdf, buildAnswersXlsx } from "@/features/forms/answers-export";

const formatSchema = z.enum(["csv", "pdf", "xlsx"]);

export const GET = withRoute<{ formId: string }>(
  { roles: ["admin"], route: "/api/admin/forms/[formId]/answers/export" },
  async ({ request, params }) => {
    const formId = requireUuid(params.formId, "formId");
    const searchParams = new URL(request.url).searchParams;
    const format = formatSchema.parse(searchParams.get("format"));
    const filters = parseAnswersListFilters(searchParams);
    const service = new FormsAnswersService();
    const [overview, summary, respondents] = await Promise.all([
      service.getOverview(formId),
      service.getSummary(formId),
      service.listAllRespondentsForExport(formId, filters),
    ]);
    const payload = {
      form: { id: formId, name: overview.formName },
      overview,
      summary,
      respondents,
      generatedAtIso: new Date().toISOString(),
    };
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

    if (format === "csv") {
      return new NextResponse(buildAnswersCsv(payload), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="respostas-${stamp}.csv"`,
        },
      });
    }
    if (format === "pdf") {
      const bytes = await buildAnswersPdf(payload);
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="respostas-${stamp}.pdf"`,
        },
      });
    }

    const bytes = await buildAnswersXlsx(payload);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="respostas-${stamp}.xlsx"`,
      },
    });
  },
);
