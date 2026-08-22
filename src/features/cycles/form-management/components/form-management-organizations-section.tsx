import { PanelSection } from "@/shared/ui/components/panel-section";
import { ADMIN_CYCLE_STATE_LABEL } from "@/shared/domain/cycle-labels";
import { formSurface } from "@/shared/layout/form-surface";
import type { FormManagementDetails } from "../types";
import { formatManagementDeadline as formatDeadline } from "./useFormManagementController";

export function FormManagementOrganizationsSection({
  details,
  startOrganizationAction,
}: {
  details: FormManagementDetails;
  startOrganizationAction: (
    action: "change_deadline" | "reopen_validation" | "reopen_responses",
    organizationId: string,
    applicableDeadlineAt: string | null,
  ) => void;
}) {
  const organizationSummary = [
    `${details.counts.linked} vinculada${details.counts.linked === 1 ? "" : "s"}`,
    `${details.counts.filling} em preenchimento`,
    `${details.counts.validating} em validação`,
    details.counts.overdue > 0
      ? `${details.counts.overdue} com prazo vencido`
      : null,
    details.counts.submitted > 0
      ? `${details.counts.submitted} enviaram`
      : null,
    details.counts.adjusting > 0
      ? `${details.counts.adjusting} em correção`
      : null,
    details.counts.concluded > 0
      ? `${details.counts.concluded} concluída${details.counts.concluded === 1 ? "" : "s"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <PanelSection
      title="Organizações"
      description={organizationSummary}
      variant="plain"
    >
      <div className={formSurface.table.wrapper}>
        <table className={formSurface.table.table}>
          <thead className={formSurface.table.head}>
            <tr>
              <th className={formSurface.table.headCell}>Organização</th>
              <th className={formSurface.table.headCell}>Situação</th>
              <th className={formSurface.table.headCell}>Prazo aplicável</th>
              <th className={formSurface.table.headCell}>Prazo</th>
              <th className={formSurface.table.headCell}>Prorrogações</th>
              <th className={formSurface.table.headCell}>Ação</th>
            </tr>
          </thead>
          <tbody className={formSurface.table.body}>
            {details.organizations.map((organization) => (
              <tr key={organization.cycleId} className={formSurface.table.row}>
                <td className={formSurface.table.cell}>
                  <p className="font-medium text-slate-900">
                    {organization.organizationAcronym}
                  </p>
                  <p className="text-xs text-slate-500">
                    {organization.organizationName}
                  </p>
                  {organization.exceptionalDeadline ? (
                    <p className="mt-1 text-xs font-medium text-amber-800">
                      Prazo excepcional
                    </p>
                  ) : null}
                </td>
                <td className={formSurface.table.cell}>
                  {ADMIN_CYCLE_STATE_LABEL[
                    organization.state as keyof typeof ADMIN_CYCLE_STATE_LABEL
                  ] ?? organization.state}
                </td>
                <td className={formSurface.table.cell}>
                  {formatDeadline(organization.applicableDeadlineAt)}
                </td>
                <td className={formSurface.table.cell}>
                  {organization.deadlineStatus === "overdue"
                    ? "Vencido"
                    : organization.deadlineStatus === "paused"
                      ? "Suspenso"
                      : organization.deadlineStatus === "on_time"
                        ? "No prazo"
                        : "—"}
                </td>
                <td className={`${formSurface.table.cell} tabular-nums`}>
                  {organization.deadlineChangeCount}
                </td>
                <td className={formSurface.table.cell}>
                  <div className="flex flex-col items-stretch gap-1.5 sm:items-start">
                    <button
                      type="button"
                      className={formSurface.secondaryButtonSm}
                      onClick={() =>
                        startOrganizationAction(
                          "change_deadline",
                          organization.organizationId,
                          organization.applicableDeadlineAt,
                        )
                      }
                    >
                      Gerenciar prazo
                    </button>
                    {organization.state === "validated" ? (
                      <button
                        type="button"
                        className={formSurface.secondaryButtonSm}
                        onClick={() =>
                          startOrganizationAction(
                            "reopen_validation",
                            organization.organizationId,
                            organization.applicableDeadlineAt,
                          )
                        }
                      >
                        Reabrir validação
                      </button>
                    ) : null}
                    {organization.state === "completed" ? (
                      <button
                        type="button"
                        className={formSurface.secondaryButtonSm}
                        onClick={() =>
                          startOrganizationAction(
                            "reopen_responses",
                            organization.organizationId,
                            organization.applicableDeadlineAt,
                          )
                        }
                      >
                        Reabrir respostas
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelSection>
  );
}
