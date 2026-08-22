import { formSurface } from "@/shared/layout/form-surface";
import { FlowSection } from "./create-cycle-form-fields";
import type { CreateCycleFormOption } from "./create-cycle-form-model";
import type { CreateCycleFormController } from "./use-create-cycle-form";

function inputClass(hasError: boolean, base: string): string {
  return hasError
    ? `${base} border-rose-400 focus:border-rose-500 focus:ring-rose-200`
    : base;
}

export function CreateCycleIdentificationSection({
  forms,
  controller,
}: {
  forms: CreateCycleFormOption[];
  controller: CreateCycleFormController;
}) {
  const { draft, fieldErrors, setField, changeForm } = controller;
  return (
    <FlowSection number={1} title="Identificação">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={formSurface.fieldGroup}>
          <label htmlFor="cycle-form" className={formSurface.label}>Formulário publicado</label>
          <select
            id="cycle-form"
            value={draft.formId}
            onChange={(event) => changeForm(event.target.value)}
            className={inputClass(Boolean(fieldErrors.formId), formSurface.inputSelect)}
            aria-invalid={Boolean(fieldErrors.formId)}
            aria-describedby={fieldErrors.formId ? "cycle-form-error" : undefined}
            required
          >
            <option value="">Selecione um formulário</option>
            {forms.map((form) => <option key={form.id} value={form.id}>{form.label}</option>)}
          </select>
          {fieldErrors.formId ? <p id="cycle-form-error" className="text-xs text-rose-700">{fieldErrors.formId}</p> : null}
        </div>
        <div className={formSurface.fieldGroup}>
          <label htmlFor="cycle-period" className={formSurface.label}>Nome do período</label>
          <input
            id="cycle-period"
            value={draft.periodLabel}
            onChange={(event) => setField("periodLabel", event.target.value)}
            placeholder="Ex.: 1º semestre ou ciclo extraordinário"
            className={inputClass(Boolean(fieldErrors.periodLabel), formSurface.input)}
            aria-invalid={Boolean(fieldErrors.periodLabel)}
            aria-describedby={fieldErrors.periodLabel ? "cycle-period-error" : "cycle-period-help"}
            maxLength={60}
            required
          />
          <p id="cycle-period-help" className="text-xs text-slate-500">
            Rótulo exibido nas telas; a referência temporal é informada separadamente.
          </p>
          {fieldErrors.periodLabel ? <p id="cycle-period-error" className="text-xs text-rose-700">{fieldErrors.periodLabel}</p> : null}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={formSurface.fieldGroup}>
          <label htmlFor="cycle-reference-start-year" className={formSurface.label}>Ano inicial de referência</label>
          <input
            id="cycle-reference-start-year"
            type="number"
            min={1900}
            max={2199}
            value={draft.referenceStartYear}
            onChange={(event) => setField("referenceStartYear", event.target.value)}
            className={inputClass(Boolean(fieldErrors.referenceStartYear), formSurface.input)}
            aria-invalid={Boolean(fieldErrors.referenceStartYear)}
            aria-describedby={fieldErrors.referenceStartYear ? "cycle-reference-start-error" : undefined}
            required
          />
          {fieldErrors.referenceStartYear ? <p id="cycle-reference-start-error" className="text-xs text-rose-700">{fieldErrors.referenceStartYear}</p> : null}
        </div>
        <div className={formSurface.fieldGroup}>
          <label htmlFor="cycle-reference-end-year" className={formSurface.label}>Ano final de referência</label>
          <input
            id="cycle-reference-end-year"
            type="number"
            min={1900}
            max={2199}
            value={draft.referenceEndYear}
            onChange={(event) => setField("referenceEndYear", event.target.value)}
            className={inputClass(Boolean(fieldErrors.referenceEndYear), formSurface.input)}
            aria-invalid={Boolean(fieldErrors.referenceEndYear)}
            aria-describedby={fieldErrors.referenceEndYear ? "cycle-reference-end-error" : undefined}
            required
          />
          {fieldErrors.referenceEndYear ? <p id="cycle-reference-end-error" className="text-xs text-rose-700">{fieldErrors.referenceEndYear}</p> : null}
        </div>
      </div>
    </FlowSection>
  );
}
