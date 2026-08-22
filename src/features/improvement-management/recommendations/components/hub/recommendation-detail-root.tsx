"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TableSkeleton } from "@/shared/ui/components/loading";
import { AdminModuleTrail } from "@/shared/ui/admin/admin-module-trail";
import { formSurface } from "@/shared/layout/form-surface";
import { layout } from "@/shared/layout/design-system";
import {
  RecommendationDetailProvider,
  useRecommendationDetailContext,
  type RecommendationDetailRole,
  type RecommendationWorkspaceSurface,
} from "./recommendation-detail-context";
import { RecommendationDetailHeader } from "./recommendation-detail-header";
import { RecommendationDetailTabs } from "./recommendation-detail-tabs";
import { workspaceTabsForBasePath } from "./workspace-tab-meta";
import { respondentReturnPathOrFallback } from "@/shared/navigation/respondent-navigation-context";
import { adminReturnPathOrFallback } from "@/shared/navigation/admin-navigation-context";

function RecommendationDetailBody({ children }: { children: React.ReactNode }) {
  const ctx = useRecommendationDetailContext();
  const searchParams = useSearchParams();

  if (ctx.loading && !ctx.row) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-white p-6 ${formSurface.card}`}>
        <TableSkeleton rows={5} cols={2} />
      </div>
    );
  }

  if (ctx.error || !ctx.row) {
    return (
      <div role="alert" aria-live="assertive" className={`${formSurface.messageError} space-y-3`}>
        <p>{ctx.error ?? "Recomendação não encontrada."}</p>
        <Link
          href={
            ctx.role === "respondent"
              ? respondentReturnPathOrFallback(searchParams.get("returnTo"), ctx.listPath)
              : adminReturnPathOrFallback(searchParams.get("returnTo"), ctx.listPath)
          }
          className={formSurface.secondaryButtonSm}
        >
          Voltar para a lista
        </Link>
      </div>
    );
  }

  const isDocument = ctx.workspaceSurface === "document" && ctx.role === "admin";
  const isSupervision = ctx.workspaceSurface === "supervision" && ctx.role === "admin";
  // No Plano de ação (supervisão), só as abas Visão geral / Ações / Monitoramento.
  // A trilha Recomendação ↔ Plano fica só na superfície do documento da recomendação.
  const showAdminTrail = isDocument;

  const tabs = isDocument
    ? []
    : isSupervision
      ? workspaceTabsForBasePath(ctx.detailBasePath, ["overview", "actions", "monitoring"], {
          actionsHrefSegment: "acoes",
        })
      : ctx.workspaceSurface === "operational" && ctx.role === "admin"
        ? workspaceTabsForBasePath(
            ctx.detailBasePath,
            ["monitoring", "actions", "overview"],
            { actionsHrefSegment: ctx.actionsTabHrefSegment, actionsLabel: ctx.actionsTabLabel },
          )
        : workspaceTabsForBasePath(
            ctx.detailBasePath,
            ["overview", "actions", "monitoring"],
            {
              actionsHrefSegment: ctx.actionsTabHrefSegment,
              actionsLabel: ctx.actionsTabLabel,
            },
          );

  const stackGap = "gap-6";
  const maxWidth =
    (ctx.workspaceSurface === "operational" ||
      ctx.workspaceSurface === "supervision" ||
      ctx.workspaceSurface === "document") &&
    ctx.role === "admin"
      ? "max-w-7xl"
      : "max-w-6xl";

  return (
    <div className={`${layout.pageStack} ${stackGap} ${maxWidth}`}>
      <RecommendationDetailHeader />
      {showAdminTrail ? (
        <AdminModuleTrail recommendationId={ctx.recommendationId} active="recommendation" />
      ) : null}
      {tabs.length > 0 ? (
        <RecommendationDetailTabs tabs={tabs} aria-label="Seções do workspace" />
      ) : null}
      <div className="min-h-56">{children}</div>
    </div>
  );
}

export function RecommendationDetailRoot({
  recommendationId,
  role,
  listPath,
  detailBasePath,
  actionsTabHrefSegment,
  actionsTabLabel,
  workspaceSurface,
  children,
}: {
  recommendationId: string;
  role: RecommendationDetailRole;
  listPath: string;
  detailBasePath?: string;
  actionsTabHrefSegment?: string;
  actionsTabLabel?: string;
  workspaceSurface?: RecommendationWorkspaceSurface;
  children: React.ReactNode;
}) {
  return (
    <RecommendationDetailProvider
      recommendationId={recommendationId}
      role={role}
      listPath={listPath}
      detailBasePath={detailBasePath}
      actionsTabHrefSegment={actionsTabHrefSegment}
      actionsTabLabel={actionsTabLabel}
      workspaceSurface={workspaceSurface}
    >
      <RecommendationDetailBody>{children}</RecommendationDetailBody>
    </RecommendationDetailProvider>
  );
}
