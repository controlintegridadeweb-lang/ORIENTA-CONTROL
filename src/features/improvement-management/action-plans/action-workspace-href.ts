import type { ActionPanelMode } from "@/features/improvement-management/action-plans/components/execution/action-plan-action-list";

export type ActionWorkspacePanel = "view" | "evidence";

export function actionWorkspaceHref(args: {
  detailBasePath: string;
  actionsTabHrefSegment: string;
  planId: string;
  panel?: ActionWorkspacePanel;
}): string {
  const params = new URLSearchParams({ action: args.planId });
  if (args.panel === "evidence") params.set("panel", "evidence");
  return `${args.detailBasePath}/${args.actionsTabHrefSegment}?${params.toString()}`;
}

export function actionPanelFromSearchParams(
  searchParams: Pick<URLSearchParams, "get">,
  planIds: ReadonlySet<string>,
): ActionPanelMode {
  const action = searchParams.get("action");
  if (!action || !planIds.has(action)) return { kind: "none" };
  if (searchParams.get("panel") === "evidence") {
    return { kind: "evidence", planId: action };
  }
  return { kind: "view", planId: action };
}

export function resolveMonitoredActionId(
  planIds: readonly string[],
  requestedId: string | null,
): string | null {
  if (planIds.length === 0) return null;
  if (requestedId && planIds.includes(requestedId)) return requestedId;
  return planIds[0] ?? null;
}

/** Preserva a ação escolhida sem perder `returnTo` nem os demais query params. */
export function withWorkspaceAction(href: string, actionId: string): string {
  const hashIndex = href.indexOf("#");
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const queryIndex = withoutHash.indexOf("?");
  const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "";
  const params = new URLSearchParams(query);
  params.set("action", actionId);
  return `${path}?${params.toString()}${hash}`;
}
