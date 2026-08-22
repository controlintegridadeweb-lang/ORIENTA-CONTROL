import { PanelSection } from "@/shared/ui/components/panel-section";
import type { FormManagementDetails } from "../types";
import { formatManagementDeadline as formatDeadline } from "./useFormManagementController";

function MetaItem({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd
        className={
          emphasize
            ? "mt-1 text-sm font-medium text-slate-900"
            : "mt-1 text-sm text-slate-800"
        }
      >
        {value}
      </dd>
    </div>
  );
}

export function FormManagementOverviewSection({
  details,
}: {
  details: FormManagementDetails;
}) {
  return (
    <PanelSection
      title="Visão geral"
      description="Identidade, situação e prazos do formulário nesta aplicação."
      variant="card"
    >
      <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <MetaItem label="Situação atual" value={details.statusLabel} emphasize />
        <MetaItem
          label="Responsável pela criação"
          value={details.createdByName || "—"}
        />
        <MetaItem
          label="Modo de prazo"
          value={
            details.deadlineMode === "global"
              ? "Prazo global do formulário"
              : "Há prazos individuais (exceções por organização)"
          }
        />
        <MetaItem
          label="Data de publicação"
          value={formatDeadline(details.publishedAt)}
        />
        <MetaItem
          label="Data de abertura"
          value={formatDeadline(details.openedAt)}
        />
        <MetaItem
          label="Data de encerramento"
          value={formatDeadline(details.closedAt)}
        />
        <MetaItem label="Período" value={details.periodLabel || "—"} />
        <MetaItem
          label="Prazo original de resposta"
          value={formatDeadline(details.originalDeadlineAt)}
        />
        <MetaItem
          label="Prazo atual de resposta"
          value={formatDeadline(details.currentGlobalDeadlineAt)}
          emphasize
        />
      </dl>
    </PanelSection>
  );
}
