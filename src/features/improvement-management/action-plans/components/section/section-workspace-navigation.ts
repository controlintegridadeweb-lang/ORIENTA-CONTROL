import type { SectionActionPlanGroup } from "@/features/improvement-management/action-plans/section-action-plan-model";
import {
  respondentActionWorkspacePath,
  respondentSectionActionWorkspacePath,
} from "@/shared/navigation/respondent-portfolio-paths";
import {
  adminPlanoAcaoDetailHref,
  adminSectionActionWorkspaceHref,
} from "@/shared/navigation/admin-paths";
import { withAdminReturnPath } from "@/shared/navigation/admin-navigation-context";
import { withRespondentReturnPath } from "@/shared/navigation/respondent-navigation-context";
import {
  SECTION_ACTION_WORKSPACE_TABS,
  type SectionActionWorkspaceTab,
} from "@/shared/navigation/section-action-workspace";

export type SectionActionPlanWorkspaceRole = "admin" | "respondent";
export type SectionActionPlanWorkspaceTab = SectionActionWorkspaceTab;

export const SECTION_WORKSPACE_TAB_ORDER = SECTION_ACTION_WORKSPACE_TABS;

export const SECTION_WORKSPACE_TAB_LABELS: Record<SectionActionPlanWorkspaceTab, string> = {
  "visao-geral": "Visão geral",
  "problemas-solucoes": "Problemas e soluções",
  acoes: "Plano de integridade e compliance",
  monitoramento: "Monitoramento",
};

export function currentSectionWorkspacePath(
  role: SectionActionPlanWorkspaceRole,
  section: SectionActionPlanGroup,
  tab: SectionActionPlanWorkspaceTab,
  returnTo?: string | null,
): string {
  if (role === "respondent") {
    return respondentSectionActionWorkspacePath(section.sectionId, section.cycleId, tab, {
      returnTo,
    });
  }
  return withAdminReturnPath(
    adminSectionActionWorkspaceHref(section.sectionId, section.cycleId, tab),
    returnTo,
  );
}

export function recommendationWorkspacePath(
  role: SectionActionPlanWorkspaceRole,
  recommendationId: string,
  tab: "acoes" | "monitoramento" | "visao-geral",
  returnPath: string,
): string {
  if (role === "respondent") {
    return withRespondentReturnPath(
      respondentActionWorkspacePath(recommendationId, tab),
      returnPath,
    );
  }
  return withAdminReturnPath(adminPlanoAcaoDetailHref(recommendationId, tab), returnPath);
}
