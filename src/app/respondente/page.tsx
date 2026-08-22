import { getCurrentUser } from "@/infrastructure/auth/current-user";
import { respondentProgress } from "@/features/respondent-progress/server";
import { computeRespondentDashboardSummary } from "@/features/respondent-progress/respondent-dashboard-summary";
import { respondentDashboardYearFromSearchParams } from "@/features/respondent-progress/respondent-dashboard-search";
import { RespondentDashboardSection } from "@/features/dashboard/components/respondent-dashboard-section";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RespondenteDashboardPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  const organizationId = user?.organizationId ?? "";
  const params = await searchParams;
  const rawYear = params.year;
  const year = respondentDashboardYearFromSearchParams(
    typeof rawYear === "string" ? rawYear : undefined,
  );

  const forms = organizationId
    ? await respondentProgress(organizationId, { year })
    : [];
  const summary = computeRespondentDashboardSummary(forms);

  return (
    <RespondentDashboardSection
      key={year}
      initialForms={forms}
      initialYear={year}
      initialSummary={summary}
    />
  );
}
