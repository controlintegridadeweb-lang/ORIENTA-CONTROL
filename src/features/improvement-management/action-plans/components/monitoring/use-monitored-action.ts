"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { resolveMonitoredActionId } from "@/features/improvement-management/action-plans/action-workspace-href";

export function useMonitoredAction(plans: ActionPlanAction[]) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selectedActionId = resolveMonitoredActionId(
    plans.map((plan) => plan.id),
    searchParams.get("action"),
  );
  const selectedPlan = plans.find((plan) => plan.id === selectedActionId) ?? null;

  const selectAction = useCallback(
    (planId: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("action", planId);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return { selectedActionId, selectedPlan, selectAction };
}
