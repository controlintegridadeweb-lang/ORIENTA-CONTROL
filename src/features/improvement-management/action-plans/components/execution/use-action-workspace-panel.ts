"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ActionPanelMode } from "@/features/improvement-management/action-plans/components/execution/action-plan-action-list";
import { actionPanelFromSearchParams } from "@/features/improvement-management/action-plans/action-workspace-href";

function actionQueryKey(searchParams: Pick<URLSearchParams, "get">): string {
  return [
    searchParams.get("action") ?? "",
    searchParams.get("panel") ?? "",
    searchParams.get("new") ?? "",
  ].join(":");
}

export function useActionWorkspacePanel(planIds: ReadonlySet<string>): {
  panel: ActionPanelMode;
  setPanel: (panel: ActionPanelMode) => void;
  hasOverride: boolean;
} {
  const searchParams = useSearchParams();
  const queryKey = actionQueryKey(searchParams);
  const fromSearch = actionPanelFromSearchParams(searchParams, planIds);
  const [override, setOverride] = useState<{
    queryKey: string;
    panel: ActionPanelMode;
  } | null>(null);

  const hasOverride = override?.queryKey === queryKey;
  const panel = hasOverride && override ? override.panel : fromSearch;

  const setPanel = useCallback(
    (next: ActionPanelMode) => {
      setOverride({ queryKey, panel: next });
    },
    [queryKey],
  );

  return { panel, setPanel, hasOverride };
}
