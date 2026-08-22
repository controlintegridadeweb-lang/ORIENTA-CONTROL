import { typography } from "@/shared/layout/design-system";
import { LoadingButton } from "@/shared/ui/components/loading";
import { PanelSection } from "@/shared/ui/components/panel-section";
import {
  PLATFORM_TIME_ZONE_LABEL,
} from "@/shared/datetime/fortaleza-date-time";
import { formSurface } from "@/shared/layout/form-surface";
import {
  FORM_ADMIN_ACTION_LABEL,
  type DeadlineScope,
} from "../domain";
import type { FormManagementController } from "./useFormManagementController";

const SCOPE_LABELS: Record<DeadlineScope, string> = {
  all: "Todas as organizações elegíveis",
  selected: "Organizações selecionadas",
  overdue: "Somente com prazo vencido",
  single: "Uma organização específica",
};

function ActionGuidance({
  action,
}: {
  action: NonNullable<FormManagementController["activeAction"]>;
}) {
  if (action === "reopen_validation") {
    return (
      <p className="text-xs leading-relaxed text-slate-600">
        Use quando o órgão já tem validação/FAMI concluídos e é preciso uma
        nova rodada de revisão. O resultado anterior permanece no histórico.
        Depois da reabertura, solicite ajuste na fila de validação para o
        respondente complementar — ou, após encerrar o acompanhamento, use
        “Reabrir para respostas”.
      </p>
    );
  }
  if (action === "reopen_responses") {
    return (
      <p className="text-xs leading-relaxed text-slate-600">
        A reabertura preserva respostas, evidências e histórico de
        validação/FAMI. Órgãos apenas validados (com FAMI) devem usar antes
        “Reabrir validação (nova rodada)”. Na reabertura parcial, somente os
        critérios selecionados poderão ser alterados.
      </p>
    );
  }
  return null;
}

function ScopeFields({ controller }: { controller: FormManagementController }) {
  const {
    details,
    scope,
    organizationIds,
    setScope,
    setOrganizationIds,
  } = controller;

  return (
    <>
      <label className={`${formSurface.fieldGroup} block max-w-md`}>
        <span className={formSurface.label}>Escopo</span>
        <select
          className={formSurface.inputSelect}
          value={scope}
          onChange={(event) => {
            setScope(event.target.value as DeadlineScope);
            setOrganizationIds([]);
          }}
        >
          {(Object.keys(SCOPE_LABELS) as DeadlineScope[]).map((key) => (
            <option key={key} value={key}>
              {SCOPE_LABELS[key]}
            </option>
          ))}
        </select>
      </label>

      {scope === "selected" || scope === "single" ? (
        <label className={`${formSurface.fieldGroup} block max-w-xl`}>
          <span className={formSurface.label}>
            {scope === "single" ? "Organização" : "Organizações"}
          </span>
          <select
            multiple={scope === "selected"}
            className={formSurface.inputSelect}
            value={scope === "single" ? organizationIds[0] ?? "" : organizationIds}
            onChange={(event) => {
              if (scope === "single") {
                setOrganizationIds(event.target.value ? [event.target.value] : []);
                return;
              }
              setOrganizationIds(
                Array.from(event.target.selectedOptions).map(
                  (option) => option.value,
                ),
              );
            }}
          >
            {details.organizations.map((organization) => (
              <option
                key={organization.organizationId}
                value={organization.organizationId}
              >
                {organization.organizationAcronym} — {organization.organizationName}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </>
  );
}

function ReopenResponseFields({
  controller,
}: {
  controller: FormManagementController;
}) {
  const {
    details,
    activeAction,
    reopenMode,
    questionVersionIds,
    setReopenMode,
    setQuestionVersionIds,
    toggleQuestionVersion,
  } = controller;

  if (activeAction !== "reopen_responses") return null;

  return (
    <>
      <fieldset className="space-y-2">
        <legend className={formSurface.label}>Tipo de reabertura</legend>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="reopen-mode"
            checked={reopenMode === "full"}
            onChange={() => {
              setReopenMode("full");
              setQuestionVersionIds([]);
            }}
          />
          Integral — todos os critérios editáveis
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="reopen-mode"
            checked={reopenMode === "partial"}
            onChange={() => setReopenMode("partial")}
          />
          Parcial — somente critérios selecionados
        </label>
      </fieldset>

      {reopenMode === "partial" ? (
        <fieldset className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
          <legend className={formSurface.label}>
            Critérios que poderão ser alterados *
          </legend>
          {details.criteria.length === 0 ? (
            <p className="text-xs text-slate-500">
              Nenhum critério disponível neste formulário.
            </p>
          ) : (
            details.criteria.map((criterion) => (
              <label
                key={criterion.questionVersionId}
                className="flex items-start gap-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={questionVersionIds.includes(
                    criterion.questionVersionId,
                  )}
                  onChange={() =>
                    toggleQuestionVersion(criterion.questionVersionId)
                  }
                />
                <span>
                  <span className="font-medium">{criterion.sectionName}</span>
                  <span className="text-slate-400"> · </span>
                  {criterion.prompt}
                </span>
              </label>
            ))
          )}
        </fieldset>
      ) : null}
    </>
  );
}

function ActiveActionForm({
  controller,
}: {
  controller: FormManagementController;
}) {
  const {
    activeAction,
    deadlineLocal,
    justification,
    pending,
    error,
    previewText,
    setDeadlineLocal,
    setJustification,
    resetForm,
    submitActiveAction,
  } = controller;

  if (!activeAction) return null;

  const showsDeadline = ![
    "suspend",
    "resume",
    "early_close",
    "reopen_validation",
  ].includes(activeAction);

  return (
    <div className={`${formSurface.subtlePanel} mt-5 space-y-4`}>
      <h3 className={typography.cardTitle}>
        {FORM_ADMIN_ACTION_LABEL[activeAction]}
      </h3>
      <ActionGuidance action={activeAction} />
      <ScopeFields controller={controller} />
      <ReopenResponseFields controller={controller} />

      {showsDeadline ? (
        <label className={`${formSurface.fieldGroup} block max-w-md`}>
          <span className={formSurface.label}>Novo prazo (data e horário)</span>
          <input
            type="datetime-local"
            className={formSurface.input}
            value={deadlineLocal}
            onChange={(event) => setDeadlineLocal(event.target.value)}
          />
          <span className="mt-1 block text-xs text-slate-500">
            {PLATFORM_TIME_ZONE_LABEL}
          </span>
        </label>
      ) : null}

      <label className={`${formSurface.fieldGroup} block max-w-2xl`}>
        <span className={formSurface.label}>Justificativa *</span>
        <textarea
          className={formSurface.inputTextarea}
          rows={4}
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
          placeholder="Descreva o motivo administrativo da operação."
        />
      </label>

      {previewText ? (
        <p className={formSurface.messageWarning}>{previewText}</p>
      ) : null}
      {error ? (
        <p role="alert" className={formSurface.messageError}>
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <LoadingButton
          type="button"
          pending={pending}
          onClick={() => void submitActiveAction()}
          className={formSurface.primaryButton}
        >
          Confirmar
        </LoadingButton>
        <button
          type="button"
          disabled={pending}
          onClick={resetForm}
          className={formSurface.secondaryButton}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function FormManagementActionsSection({
  controller,
}: {
  controller: FormManagementController;
}) {
  const { details, postValidationGuidance, startAction } = controller;

  return (
    <PanelSection
      id="acoes"
      title="Ações administrativas"
      description="Somente ações compatíveis com a situação atual ficam habilitadas."
      variant="card"
    >
      <div className="flex flex-wrap gap-2">
        {details.actions.map((action) => (
          <button
            key={action.key}
            type="button"
            disabled={!action.available && action.key !== "view_history"}
            title={action.reason}
            onClick={() => startAction(action.key)}
            className={`${formSurface.secondaryButtonSm} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {action.label}
          </button>
        ))}
      </div>

      {postValidationGuidance ? (
        <div
          className={`${formSurface.messageNeutral} mt-4 border-sky-200 bg-sky-50 text-sky-950`}
        >
          <p className="font-medium">Validação reaberta</p>
          <p className="mt-1">{postValidationGuidance}</p>
        </div>
      ) : null}

      <ActiveActionForm controller={controller} />
    </PanelSection>
  );
}
