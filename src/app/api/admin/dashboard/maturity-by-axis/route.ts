import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/infrastructure/api/with-route";
import { maturityDashboardAvailableYearsForOrganization } from "@/features/dashboard/queries";
import { buildFamiMaturityView } from "@/features/fami/fami-maturity-view";

const querySchema = z.object({
  organizationId: z.string().uuid(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
});

/** Resultado FAMI é uma leitura de diagnóstico específico, nunca uma média global. */
export const GET = withRoute(
  {
    roles: ["admin"],
    route: "/api/admin/dashboard/maturity-by-axis",
    logMessage: "Failed to load dashboard maturity by axis",
    internalErrorMessage: "Falha ao carregar a maturidade por eixo.",
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      organizationId: url.searchParams.get("organizationId") ?? undefined,
      year: url.searchParams.get("year") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Selecione uma organização válida para consultar o Resultado FAMI.",
        },
        { status: 400 },
      );
    }

    const { organizationId, year } = parsed.data;
    const [view, availableYears] = await Promise.all([
      buildFamiMaturityView({
        kind: "latest-org",
        organizationId,
        closingYear: year,
      }),
      maturityDashboardAvailableYearsForOrganization(organizationId),
    ]);

    if (!view) {
      return NextResponse.json({
        items: [],
        scope: "organization" as const,
        organizationId,
        snapshotYearApplied: year ?? null,
        availableYears,
        overallPercentage: null,
        cycleId: null,
        formId: null,
        formName: null,
        cycleState: null,
        isOfficialScore: false,
        applicableQuestions: 0,
        waivedQuestions: 0,
        notApplicableResponses: 0,
        calculatedAt: null,
      });
    }

    return NextResponse.json({
      items: view.axes,
      scope: "organization" as const,
      organizationId,
      snapshotYearApplied: year ?? null,
      availableYears,
      overallPercentage:
        view.global.maturityLevel == null ? null : view.global.percentage,
      cycleId: view.cycleId,
      formId: view.formId,
      formName: view.formName,
      cycleState: view.cycleState,
      isOfficialScore: view.meta.isOfficialScore,
      applicableQuestions: view.meta.applicableQuestions,
      waivedQuestions: view.meta.waivedQuestions,
      notApplicableResponses: view.meta.notApplicableResponses,
      calculatedAt: view.meta.calculatedAt,
    });
  },
);
