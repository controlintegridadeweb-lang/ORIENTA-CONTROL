import {
  formatFormViewSummary,
  type FormViewSummary,
} from "@/features/validation/form-view-model";
import { formSurface } from "@/shared/layout/form-surface";

export function ValidationFormSummary({
  summary,
}: {
  summary: FormViewSummary;
}) {
  const lines = formatFormViewSummary(summary);
  return (
    <section
      className={`${formSurface.dashboardPanel} px-4 py-4 sm:px-5`}
      aria-label="Resumo do formulário"
    >
      <p className="text-base font-semibold text-slate-900">
        {lines.criteriaLine}
      </p>
      <p className="mt-1 text-sm text-slate-600">{lines.answersLine}</p>
      <p className="mt-1 text-sm text-slate-600">{lines.analysisLine}</p>
    </section>
  );
}
