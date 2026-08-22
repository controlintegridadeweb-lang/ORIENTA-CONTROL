"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AdminMonitoringTableFrame } from "@/features/improvement-management/monitoring/components/admin-monitoring-table-primitives";

import { AdminActionPlanProgress } from "@/features/improvement-management/action-plans/components/admin/admin-action-plan-progress";
import { AdminActionPlanStatusBadge } from "@/features/improvement-management/action-plans/components/admin/admin-action-plan-status-badge";
import {
  firstLineAction,
  firstLineRecommendation,
  formatPlanDate,
  riskBadge,
} from "@/features/improvement-management/action-plans/components/admin/admin-action-plan-row-utils";
import type { AdminPlanItem } from "@/features/improvement-management/action-plans/admin-monitoring";
import {
  adminPlanoAcaoDetailHref,
  adminSectionActionWorkspaceHref,
} from "@/shared/navigation/admin-paths";
import { formSurface } from "@/shared/layout/form-surface";
import { AxisBadge } from "@/shared/ui/components/axis-badge";
import { StatusPill } from "@/shared/ui/components/status-pill";
import { currentAdminListPath, withAdminReturnPath } from "@/shared/navigation/admin-navigation-context";

type Props = {
  items: AdminPlanItem[];
  hideOrganizationColumn?: boolean;
};

export function AdminActionPlanTable({
  items,
  hideOrganizationColumn = false,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = currentAdminListPath(pathname, searchParams.toString());

  if (items.length === 0) return null;

  return (
    <AdminMonitoringTableFrame minWidthClassName="min-w-280">
      <thead className={formSurface.table.head}>
        <tr>
          {hideOrganizationColumn ? null : (
            <th className={`${formSurface.table.headCell} min-w-32`}>Organização</th>
          )}
          <th className={`${formSurface.table.headCell} min-w-24`}>Eixo</th>
          <th className={`${formSurface.table.headCell} min-w-36`}>Seção</th>
          <th className={`${formSurface.table.headCell} min-w-48`}>Recomendação</th>
          <th className={formSurface.table.headCell}>Situação</th>
          <th className={`${formSurface.table.headCell} min-w-40`}>Ação</th>
          <th className={`${formSurface.table.headCell} min-w-28`}>Progresso</th>
          <th className={formSurface.table.headCell}>Prazo</th>
          <th className={formSurface.table.headCell}>Risco</th>
          <th className={`${formSurface.table.headCell} w-16 text-right`}>Ações</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const recommendationTitle = firstLineRecommendation(item.recommendationText);
          const actionTitle = firstLineAction(item);
          const risk = riskBadge(item.risk);
          const sectionHref = withAdminReturnPath(
            adminSectionActionWorkspaceHref(item.sectionId, item.cycleId, "visao-geral"),
            returnTo,
          );
          const planoHref = withAdminReturnPath(
            adminPlanoAcaoDetailHref(item.recommendationId, "visao-geral"),
            returnTo,
          );

          return (
            <tr
              key={item.rowKey}
              className={formSurface.table.row}
            >
              {hideOrganizationColumn ? null : (
                <td className={`${formSurface.table.cell} text-slate-700`}>
                  <span className="line-clamp-2" title={item.organizationName}>
                    {item.organizationName}
                  </span>
                </td>
              )}
              <td className={formSurface.table.cell}>
                {item.axisName ? <AxisBadge axisName={item.axisName} prefix={false} /> : <span>—</span>}
              </td>
              <td className={formSurface.table.cell}>
                <Link
                  href={sectionHref}
                  className="line-clamp-2 font-medium text-slate-800 underline-offset-2 hover:text-slate-950 hover:underline"
                  title={`Abrir plano da seção ${item.sectionName}`}
                >
                  {item.sectionName || "—"}
                </Link>
              </td>
              <td className={formSurface.table.cell}>
                <p
                  className="line-clamp-2 font-semibold text-slate-900"
                  title={recommendationTitle}
                >
                  {recommendationTitle}
                </p>
              </td>
              <td className={formSurface.table.cell}>
                <AdminActionPlanStatusBadge view={item.view} />
              </td>
              <td className={formSurface.table.cell}>
                {actionTitle ? (
                  <p className="line-clamp-2 text-sm text-slate-800" title={actionTitle}>
                    {actionTitle}
                  </p>
                ) : (
                  <span className="text-sm text-slate-400">—</span>
                )}
              </td>
              <td className={`${formSurface.table.cell} min-w-32`}>
                <div className="flex min-w-28 items-center gap-2.5">
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-800">
                    {item.progress}%
                  </span>
                  <div className="min-w-16 flex-1">
                    <AdminActionPlanProgress
                      value={item.progress}
                      overdue={item.isOverdue}
                      size="xs"
                      showLabel={false}
                    />
                  </div>
                </div>
              </td>
              <td
                className={`${formSurface.table.cell} whitespace-nowrap ${
                  item.isOverdue ? "font-semibold text-rose-700" : "text-slate-700"
                }`}
              >
                {formatPlanDate(item.dueDate)}
              </td>
              <td className={formSurface.table.cell}>
                <StatusPill className={risk.className}>{risk.label}</StatusPill>
              </td>
              <td className={`${formSurface.table.cell} text-right`}>
                <Link
                  href={planoHref}
                  title="Abrir plano"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-white/80 hover:text-slate-900"
                >
                  <ArrowRight className="h-4 w-4" aria-hidden />
                  <span className="sr-only">Abrir plano</span>
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </AdminMonitoringTableFrame>
  );
}
