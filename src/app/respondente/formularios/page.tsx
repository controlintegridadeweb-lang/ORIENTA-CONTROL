import { getCurrentUser } from "@/infrastructure/auth/current-user";
import { respondentProgress } from "@/features/respondent-progress/server";
import { respondentDashboardYearFromSearchParams } from "@/features/respondent-progress/respondent-dashboard-search";
import { RespondentFormulariosSection } from "@/features/workbench/components/respondent-form/respondent-forms-section";
import { formSurface } from "@/shared/layout/form-surface";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RespondenteFormulariosPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user?.organizationId) {
    return (
      <div className={formSurface.messageWarning}>
        Sua conta não está vinculada a uma organização. Entre em contato com o administrador.
      </div>
    );
  }

  const params = await searchParams;
  const rawYear = params.year;
  const year = respondentDashboardYearFromSearchParams(
    typeof rawYear === "string" ? rawYear : undefined,
  );
  const forms = await respondentProgress(user.organizationId, { year });

  return (
    <RespondentFormulariosSection
      key={year}
      initialForms={forms}
      initialYear={year}
    />
  );
}
