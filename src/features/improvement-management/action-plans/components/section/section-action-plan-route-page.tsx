import { redirect } from "next/navigation";
import { SectionActionPlanWorkspace, type SectionActionPlanWorkspaceRole, type SectionActionPlanWorkspaceTab } from "./section-action-plan-workspace";
import { parseUuidParam } from "@/shared/validation/uuid";
import { respondentReturnPathOrFallback } from "@/shared/navigation/respondent-navigation-context";
import { adminReturnPathOrFallback } from "@/shared/navigation/admin-navigation-context";

export type SectionActionPlanRouteProps = {
  params: Promise<{ sectionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function SectionActionPlanRoutePage({
  role,
  activeTab,
  params,
  searchParams,
}: SectionActionPlanRouteProps & {
  role: SectionActionPlanWorkspaceRole;
  activeTab: SectionActionPlanWorkspaceTab;
}) {
  const [{ sectionId: rawSectionId }, sp] = await Promise.all([params, searchParams]);
  const sectionId = parseUuidParam(rawSectionId);
  const cycleId = parseUuidParam(first(sp.cycleId));
  const listFallback = role === "admin"
    ? "/admin/plano-acao"
    : "/respondente/portfolio-recomendacoes?view=action-plan";
  if (!sectionId || !cycleId) redirect(listFallback);

  const rawReturnTo = first(sp.returnTo);
  const returnTo = role === "admin"
    ? adminReturnPathOrFallback(rawReturnTo, listFallback)
    : respondentReturnPathOrFallback(rawReturnTo, listFallback);

  return (
    <SectionActionPlanWorkspace
      role={role}
      sectionId={sectionId}
      cycleId={cycleId}
      activeTab={activeTab}
      returnTo={returnTo}
    />
  );
}
