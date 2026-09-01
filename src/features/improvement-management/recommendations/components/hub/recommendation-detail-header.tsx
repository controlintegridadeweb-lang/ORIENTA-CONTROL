"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { layout, typography } from "@/shared/layout/design-system";
import { adminPlanoAcaoDetailHref, adminPlanoAcaoHref, adminRecomendacoesHref } from "@/shared/navigation/admin-paths";
import { adminReturnLabel, adminReturnPathOrFallback, withAdminReturnPath } from "@/shared/navigation/admin-navigation-context";
import {
  RESPONDENT_ACTION_PLAN_MODULE_LABEL,
  RESPONDENT_RECOMMENDATIONS_PORTFOLIO_LABEL,
} from "@/shared/navigation/respondent-portfolio-paths";
import { RecommendationStatusBadge } from "@/features/improvement-management/components/shared/recommendation-status-badge";
import type { RecommendationStatus } from "@/features/improvement-management/recommendations/schemas";
import { useRecommendationDetailContext } from "./recommendation-detail-context";
import { workspaceTabMeta } from "./workspace-tab-meta";
import {
  respondentReturnLabel,
  respondentReturnPathOrFallback,
} from "@/shared/navigation/respondent-navigation-context";

function supervisionTabLabel(pathname: string): string | null {
  if (pathname.endsWith("/monitoramento")) return "Monitoramento";
  if (pathname.endsWith("/acoes")) return "Plano de integridade e compliance";
  if (pathname.endsWith("/visao-geral")) return "Visão geral";
  return null;
}

function RecommendationDetailTitle({ status }: { status: RecommendationStatus }) {
  return (
    <div className="space-y-2">
      <h1 className={typography.pageTitle}>Detalhes da recomendação</h1>
      <RecommendationStatusBadge status={status} />
    </div>
  );
}

export function RecommendationDetailHeader() {
  const ctx = useRecommendationDetailContext();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const {
    role,
    listPath,
    respondentItem,
    adminItem,
    workspaceSurface,
  } = ctx;

  const respondentBackPath =
    role === "respondent"
      ? respondentReturnPathOrFallback(searchParams.get("returnTo"), listPath)
      : listPath;
  const adminBackPath =
    role === "admin"
      ? adminReturnPathOrFallback(searchParams.get("returnTo"), listPath)
      : listPath;
  const backPath = role === "admin" ? adminBackPath : respondentBackPath;
  const adminReturnTo = role === "admin" ? adminBackPath : null;

  const operational = workspaceSurface === "operational";
  const adminDocument = workspaceSurface === "document" && role === "admin";
  const adminSupervision = workspaceSurface === "supervision" && role === "admin";
  const adminOperational = operational && role === "admin";

  const item = role === "respondent" ? respondentItem : adminItem;
  if (!item) return null;

  const tabMeta = workspaceTabMeta(pathname);
  const slimWorkspaceHeader =
    (operational && role === "respondent") ||
    (role === "admin" && (adminDocument || adminSupervision || adminOperational));

  const breadcrumbParts =
    role === "respondent"
      ? [
          respondentItem?.axisName,
          respondentItem?.sectionName,
          operational
            ? RESPONDENT_ACTION_PLAN_MODULE_LABEL
            : RESPONDENT_RECOMMENDATIONS_PORTFOLIO_LABEL,
          ...(operational ? [tabMeta.label] : []),
        ].filter(Boolean)
      : adminDocument
        ? [adminItem?.axisName, adminItem?.sectionName, "Recomendação"].filter(Boolean)
        : adminSupervision
          ? [
              adminItem?.axisName,
              adminItem?.sectionName,
              "Plano de integridade e compliance",
              supervisionTabLabel(pathname),
            ].filter(Boolean)
          : adminOperational
            ? [
                adminItem?.axisName,
                adminItem?.sectionName,
                "Plano de integridade e compliance",
                "Monitoramento",
              ].filter(Boolean)
            : [adminItem?.axisName, adminItem?.sectionName, "Recomendação"].filter(Boolean);

  const planoHref =
    role === "respondent"
      ? respondentBackPath
      : withAdminReturnPath(adminPlanoAcaoHref(item.recommendationId), adminReturnTo);

  const supervisaoHref =
    role === "admin"
      ? withAdminReturnPath(
          adminPlanoAcaoDetailHref(item.recommendationId, "monitoramento"),
          adminReturnTo,
        )
      : null;

  const recHref =
    role === "admin"
      ? withAdminReturnPath(adminRecomendacoesHref(item.recommendationId), adminReturnTo)
      : null;

  const backLabel = role === "admin"
    ? adminReturnLabel(adminBackPath)
    : respondentReturnLabel(respondentBackPath);
  const status =
    role === "respondent"
      ? respondentItem!.status
      : adminItem!.recommendationStatus;

  if (slimWorkspaceHeader) {
    return (
      <header className="space-y-4 border-b border-slate-100 pb-6">
        <Link
          href={backPath}
          className={`inline-flex items-center gap-1 ${typography.inlineNavLink} text-sm font-medium`}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {backLabel}
        </Link>

        <RecommendationDetailTitle status={status} />

        {adminDocument ? (
          <div className="flex flex-wrap gap-2 text-sm">
            {supervisaoHref ? (
              <Link href={supervisaoHref} className={typography.inlineNavLink}>
                Ir para monitoramento
              </Link>
            ) : null}
            <Link href={planoHref} className={typography.inlineNavLink}>
              Ir para execução
            </Link>
          </div>
        ) : null}
        {adminSupervision && recHref ? (
          <Link href={recHref} className={`${typography.inlineNavLink} text-sm`}>
            Ver recomendação
          </Link>
        ) : null}
      </header>
    );
  }

  return (
    <header className={`${layout.sectionStack} space-y-5 border-b border-slate-100 pb-8`}>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={backPath}
          className={`inline-flex items-center gap-1 ${typography.inlineNavLink} text-sm font-medium`}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {backLabel}
        </Link>
      </div>

      <nav className="min-w-0 overflow-x-auto overscroll-x-contain text-caption text-slate-500" aria-label="Navegação hierárquica">
        <ol className="flex min-w-0 flex-nowrap items-center gap-x-2 gap-y-1 sm:flex-wrap">
          {breadcrumbParts.map((part, i) => (
            <li key={`${part}-${i}`} className="flex shrink-0 items-center gap-2">
              {i > 0 ? <span className="text-slate-300 select-none">/</span> : null}
              <span
                className={
                  i === breadcrumbParts.length - 1
                    ? "max-w-48 truncate font-semibold text-slate-800 sm:max-w-none sm:whitespace-normal"
                    : "max-w-36 truncate text-slate-600 sm:max-w-none"
                }
              >
                {part}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      <RecommendationDetailTitle status={status} />
      <p className={`${typography.meta} text-caption`}>
        {role === "admin" && adminItem ? (
          <>
            <span className="font-medium text-slate-600">{adminItem.organizationName}</span>
            <span className="mx-1.5 text-slate-300">·</span>
          </>
        ) : null}
        <span>{item.formName}</span>
        {role === "admin" && adminItem ? (
          <span className="tabular-nums text-slate-400"> v{adminItem.formVersion}</span>
        ) : null}
      </p>
    </header>
  );
}
