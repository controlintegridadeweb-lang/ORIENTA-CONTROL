"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  AdminMonitoringTableFrame,
  adminMonitoringTableClamp,
  adminMonitoringTableTextCell,
} from "@/features/improvement-management/monitoring/components/admin-monitoring-table-primitives";

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
    <AdminMonitoringTableFrame minWidthClassName="min-w-320">
      <thead className={formSurface.brandTable.head}>
        <tr>
          {hideOrganizationColumn ? null : (
            <th scope="col" className={`${formSurface.brandTable.headCell} min-w-36`}>
              Organização
            </th>
          )}
          <th scope="col" className={`${formSurface.brandTable.headCell} min-w-28 whitespace-nowrap`}>
            Eixo
          </th>
          <th scope="col" className={`${formSurface.brandTable.headCell} min-w-40`}>
            Seção
          </th>
          <th scope="col" className={`${formSurface.brandTable.headCell} min-w-48`}>
            Recomendação
          </th>
          <th scope="col" className={`${formSurface.brandTable.headCell} min-w-32 whitespace-nowrap`}>
            Situação
          </th>
          <th scope="col" className={`${formSurface.brandTable.headCell} min-w-40`}>
            Ação
          </th>
          <th scope="col" className={`${formSurface.brandTable.headCell} min-w-36 whitespace-nowrap`}>
            Progresso
          </th>
          <th scope="col" className={`${formSurface.brandTable.headCell} min-w-36 whitespace-nowrap`}>
            Prazo
          </th>
          <th scope="col" className={`${formSurface.brandTable.headCell} min-w-28 whitespace-nowrap`}>
            Risco
          </th>
          <th scope="col" className={`${formSurface.brandTable.headCell} min-w-36 text-right whitespace-nowrap`}>
            Ações
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, index) => {
          const recommendationTitle = firstLineRecommendation(item.recommendationText);
          const actionTitle = firstLineAction(item);
          const risk = riskBadge(item.risk);
          const rowClass =
            index % 2 === 0 ? formSurface.brandTable.rowEven : formSurface.brandTable.rowOdd;
          const planoHref = withAdminReturnPath(
            adminPlanoAcaoDetailHref(item.recommendationId, "visao-geral"),
            returnTo,
          );
          const sectionHref = planoHref;

          return (
            <tr key={item.rowKey} className={rowClass}>
              {hideOrganizationColumn ? null : (
                <td className={adminMonitoringTableTextCell}>
                  <span
                    className={`${adminMonitoringTableClamp} font-semibold text-slate-900`}
                    title={item.organizationName}
                  >
                    {item.organizationName}
                  </span>
                </td>
              )}
              <td className={`${formSurface.brandTable.cell} align-middle`}>
                {item.axisName ? <AxisBadge axisName={item.axisName} prefix={false} /> : <span>—</span>}
              </td>
              <td className={adminMonitoringTableTextCell}>
                <Link
                  href={sectionHref}
                  className={`${adminMonitoringTableClamp} font-semibold text-slate-900 underline-offset-2 hover:text-slate-950 hover:underline`}
                  title={`Abrir plano da seção ${item.sectionName}`}
                >
                  {item.sectionName || "—"}
                </Link>
              </td>
              <td className={adminMonitoringTableTextCell}>
                <p
                  className={`${adminMonitoringTableClamp} font-semibold text-slate-900`}
                  title={recommendationTitle}
                >
                  {recommendationTitle}
                </p>
              </td>
              <td className={`${formSurface.brandTable.cell} align-middle`}>
                <AdminActionPlanStatusBadge view={item.view} />
              </td>
              <td className={adminMonitoringTableTextCell}>
                {actionTitle ? (
                  <p className={`${adminMonitoringTableClamp} text-slate-700`} title={actionTitle}>
                    {actionTitle}
                  </p>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className={`${formSurface.brandTable.cell} align-middle whitespace-nowrap`}>
                <div className="inline-flex w-32 items-center gap-2">
                  <span className="w-9 shrink-0 text-xs font-semibold tabular-nums text-slate-800">
                    {item.progress}%
                  </span>
                  <div className="w-16 shrink-0">
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
                className={`${formSurface.brandTable.cellMuted} align-middle whitespace-nowrap ${
                  item.isOverdue ? "font-semibold text-rose-700" : ""
                }`}
              >
                {formatPlanDate(item.dueDate)}
              </td>
              <td className={`${formSurface.brandTable.cell} align-middle whitespace-nowrap`}>
                <StatusPill className={risk.className}>{risk.label}</StatusPill>
              </td>
              <td className={`${formSurface.brandTable.cell} align-middle text-right whitespace-nowrap`}>
                <Link href={planoHref} className={formSurface.primaryButtonSm}>
                  Abrir plano
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </AdminMonitoringTableFrame>
  );
}
