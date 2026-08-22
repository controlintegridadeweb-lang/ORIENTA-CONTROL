import { NextResponse } from "next/server";
import { z } from "zod";
import { DomainAccessError } from "@/infrastructure/api/domain-errors";
import { withRoute } from "@/infrastructure/api/with-route";
import { respondentProgress } from "@/features/respondent-progress/server";
import {
  clampRespondentDashboardYear,
  defaultRespondentDashboardYear,
  RESPONDENT_DASHBOARD_MAX_YEAR,
  RESPONDENT_DASHBOARD_MIN_YEAR,
} from "@/features/respondent-progress/respondent-dashboard-year";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  year: z.coerce
    .number()
    .int()
    .min(RESPONDENT_DASHBOARD_MIN_YEAR)
    .max(RESPONDENT_DASHBOARD_MAX_YEAR)
    .optional(),
});

export const GET = withRoute(
  {
    roles: ["respondent"],
    route: "/api/respondent/dashboard/forms-progress",
    logMessage: "Failed to load respondent dashboard forms progress",
    internalErrorMessage: "Falha ao carregar os diagnósticos.",
  },
  async ({ request, auth }) => {
    if (!auth.organizationId) {
      throw new DomainAccessError("Usuário sem organização vinculada.");
    }

    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      year: url.searchParams.get("year") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parâmetros de período inválidos." },
        { status: 400 },
      );
    }

    const year = clampRespondentDashboardYear(
      parsed.data.year ?? defaultRespondentDashboardYear(),
    );
    const items = await respondentProgress(auth.organizationId, { year });
    return NextResponse.json({ items, year });
  },
);
