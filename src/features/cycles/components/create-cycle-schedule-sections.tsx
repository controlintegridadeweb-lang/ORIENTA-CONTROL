import { formSurface } from "@/shared/layout/form-surface";
import { PLATFORM_TIME_ZONE_LABEL } from "@/shared/datetime/fortaleza-date-time";
import {
  ChoiceCard,
  FlowSection,
  ProgrammedDate,
} from "./create-cycle-form-fields";
import { DEFAULT_REMINDERS } from "./create-cycle-form-model";
import type { CreateCycleFormController } from "./use-create-cycle-form";

function inputClass(hasError: boolean, base: string): string {
  return hasError
    ? `${base} border-rose-400 focus:border-rose-500 focus:ring-rose-200`
    : base;
}

export function CreateCycleLaunchSection({
  controller,
}: {
  controller: CreateCycleFormController;
}) {
  const { draft, fieldErrors, changeLaunchMode, setField } = controller;
  return (
    <FlowSection number={3} title="Abertura e prazo">
      <div className="grid gap-3 lg:grid-cols-3">
        <ChoiceCard
          name="launch-mode"
          checked={draft.launchMode === "draft"}
          onChange={() => changeLaunchMode("draft")}
          title="Salvar como rascunho"
          description="Os respondentes ainda não terão acesso."
        />
        <ChoiceCard
          name="launch-mode"
          checked={draft.launchMode === "open"}
          onChange={() => changeLaunchMode("open")}
          title="Abrir agora"
          description="Cria e libera imediatamente para resposta."
        />
        <ChoiceCard
          name="launch-mode"
          checked={draft.launchMode === "schedule"}
          onChange={() => changeLaunchMode("schedule")}
          title="Agendar abertura"
          description="Cria os rascunhos agora e abre na data definida."
        />
      </div>

      {draft.launchMode !== "draft" ? (
        <>
          <p className="text-xs text-slate-500">
            Datas e horários seguem o {PLATFORM_TIME_ZONE_LABEL}.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={formSurface.fieldGroup}>
              <label htmlFor="cycle-start" className={formSurface.label}>Abertura</label>
              <input
                id="cycle-start"
                type="datetime-local"
                value={draft.startsAt}
                onChange={(event) => setField("startsAt", event.target.value)}
                className={inputClass(Boolean(fieldErrors.startsAt), formSurface.input)}
                aria-invalid={Boolean(fieldErrors.startsAt)}
                aria-describedby={fieldErrors.startsAt ? "cycle-start-error" : undefined}
                readOnly={draft.launchMode === "open"}
                required
              />
              {draft.launchMode === "open" ? (
                <p className="text-xs text-slate-500">Definida automaticamente para agora.</p>
              ) : null}
              {fieldErrors.startsAt ? <p id="cycle-start-error" className="text-xs text-rose-700">{fieldErrors.startsAt}</p> : null}
            </div>
            <div className={formSurface.fieldGroup}>
              <label htmlFor="cycle-deadline" className={formSurface.label}>Prazo de resposta</label>
              <input
                id="cycle-deadline"
                type="datetime-local"
                value={draft.responseDeadlineAt}
                onChange={(event) => setField("responseDeadlineAt", event.target.value)}
                className={inputClass(Boolean(fieldErrors.responseDeadlineAt), formSurface.input)}
                aria-invalid={Boolean(fieldErrors.responseDeadlineAt)}
                aria-describedby={fieldErrors.responseDeadlineAt ? "cycle-deadline-error" : undefined}
                required
              />
              {fieldErrors.responseDeadlineAt ? <p id="cycle-deadline-error" className="text-xs text-rose-700">{fieldErrors.responseDeadlineAt}</p> : null}
            </div>
          </div>
        </>
      ) : null}
    </FlowSection>
  );
}

export function CreateCycleAutomationSection({
  controller,
}: {
  controller: CreateCycleFormController;
}) {
  const { draft, fieldErrors, setField, toggleReminder } = controller;
  if (draft.launchMode === "draft") return null;

  return (
    <FlowSection number={4} title="Ações programadas (opcional)">
      <div className="space-y-4">
        <fieldset className={formSurface.subtlePanel}>
          <legend className="text-sm font-semibold text-slate-800">Lembretes antes do prazo</legend>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-700">
            {DEFAULT_REMINDERS.map((offset) => (
              <label key={offset} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.reminderOffsetsDays.includes(offset)}
                  onChange={(event) => toggleReminder(offset, event.target.checked)}
                />
                {offset === 0 ? "No dia do prazo" : `${offset} dias antes`}
              </label>
            ))}
          </div>
        </fieldset>

        <ProgrammedDate
          checked={draft.scheduleValidation}
          onCheckedChange={(checked) => {
            setField("scheduleValidation", checked);
            if (!checked) setField("validationDeadlineAt", "");
          }}
          title="Conclusão automática, se a validação estiver pronta"
          description="O sistema apenas verifica e conclui diagnósticos que já estejam em validação e sem pendências; as decisões continuam sendo humanas."
          inputId="validation-deadline"
          value={draft.validationDeadlineAt}
          onValueChange={(value) => setField("validationDeadlineAt", value)}
          error={fieldErrors.validationDeadlineAt}
        />
        <ProgrammedDate
          checked={draft.scheduleClose}
          onCheckedChange={(checked) => {
            setField("scheduleClose", checked);
            if (!checked) setField("cycleCloseAt", "");
          }}
          title="Agendar encerramento automático da avaliação"
          description="O sistema encerra apenas a avaliação de diagnósticos validados com o plano de ação completo; o plano permanece disponível para acompanhamento."
          inputId="cycle-close-at"
          value={draft.cycleCloseAt}
          onValueChange={(value) => setField("cycleCloseAt", value)}
          error={fieldErrors.cycleCloseAt}
        />
      </div>
    </FlowSection>
  );
}
