import { SectionActionPlanRoutePage, type SectionActionPlanRouteProps } from "@/features/improvement-management/action-plans/components/section/section-action-plan-route-page";
export default async function Page(props: SectionActionPlanRouteProps) {
  return SectionActionPlanRoutePage({ ...props, role: "respondent", activeTab: "acoes" });
}
