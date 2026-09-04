"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  actionFromAdminPlanItem,
  type AdminPlanItem,
} from "@/features/improvement-management/action-plans/admin-monitoring";
import {
  buildSectionActionPlanHierarchy,
  sectionActionPlanSourcesFromListItems,
} from "@/features/improvement-management/action-plans/section-action-plan-model";
import { SectionActionPlanHierarchyList } from "@/features/improvement-management/action-plans/components/section/section-action-plan-hierarchy-list";
import { adminSectionPlanEntryHref } from "@/shared/navigation/admin-paths";
import { currentAdminListPath, withAdminReturnPath } from "@/shared/navigation/admin-navigation-context";

type Props = {
  items: AdminPlanItem[];
  hideOrganization?: boolean;
};

export function AdminActionPlanList({ items, hideOrganization = false }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = currentAdminListPath(pathname, searchParams.toString());
  const hierarchy = useMemo(
    () =>
      buildSectionActionPlanHierarchy(
        sectionActionPlanSourcesFromListItems(
          items.map((item) => {
            const action = actionFromAdminPlanItem(item);
            return {
              cycleId: item.cycleId,
              formName: item.formName,
              periodLabel: item.periodLabel,
              organizationName: item.organizationName,
              axisId: item.axisId,
              axisName: item.axisName,
              sectionId: item.sectionId,
              sectionName: item.sectionName,
              sectionOrder: item.sectionOrder,
              questionId: item.questionId,
              questionOrder: item.questionOrder,
              recommendationId: item.recommendationId,
              questionPrompt: item.questionPrompt,
              recommendationText: item.recommendationText,
              plans: action ? [action] : [],
            };
          }),
        ),
      ),
    [items],
  );

  return (
    <SectionActionPlanHierarchyList
      hierarchy={hierarchy}
      showOrganization={!hideOrganization}
      planHref={(section) =>
        withAdminReturnPath(
          adminSectionPlanEntryHref(section.sectionId, section.cycleId, "/admin/plano-acao"),
          returnTo,
        )
      }
    />
  );
}
