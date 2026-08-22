import { PanelSection } from "@/shared/ui/components/panel-section";
import type { FormManagementDetails } from "../types";
import { formatManagementDeadline as formatDeadline } from "./useFormManagementController";

const ACTION_LABELS: Record<string, string> = {
  change_deadline: "Alteração de prazo",
  extend_deadline: "Prorrogação de prazo",
  early_close: "Encerramento antecipado",
  reopen_responses: "Reabertura para respostas",
  reopen_validation: "Reabertura de validação",
  suspend: "Suspensão da coleta",
  resume: "Retomada da coleta",
};

export function FormManagementHistorySection({
  history,
}: {
  history: FormManagementDetails["history"];
}) {
  return (
    <PanelSection
      id="historico"
      title="Histórico de alterações"
      description="Linha do tempo imutável. Registros não podem ser apagados ou sobrescritos."
      variant="card"
    >
      {history.length === 0 ? (
        <p className="text-sm text-slate-600">Nenhuma alteração administrativa registrada.</p>
      ) : (
        <ol className="divide-y divide-slate-100">
          {history.map((item) => (
            <li key={item.id} className="py-4 first:pt-0 last:pb-0 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-slate-900">
                  {ACTION_LABELS[item.action] ?? item.action}
                </p>
                <p className="text-xs text-slate-500">{formatDeadline(item.createdAt)}</p>
              </div>
              <p className="mt-1 text-slate-700">
                {item.organizationName} · Escopo: {item.scope}
              </p>
              <p className="mt-1 text-slate-600">
                Prazo anterior: {formatDeadline(item.previousDeadlineAt)} → Novo prazo:{" "}
                {formatDeadline(item.newDeadlineAt)}
              </p>
              <p className="mt-1 text-slate-600">
                Responsável: {item.actorName || "Administrador"}
              </p>
              <p className="mt-2 text-slate-700">{item.justification}</p>
            </li>
          ))}
        </ol>
      )}
    </PanelSection>
  );
}
