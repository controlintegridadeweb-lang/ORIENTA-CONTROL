import Link from "next/link";
import {
  getRespondentFormPresentation,
  type RespondentProgress,
} from "@/features/respondent-progress";
import { formSurface } from "@/shared/layout/form-surface";
import { RespondentFormContext } from "@/features/workbench/components/respondent-form/respondent-form-context";

type Props = {
  contextYear?: number;
  form: RespondentProgress;
  /** `row`: lista compacta no dashboard; `card`: item destacado na página dedicada. */
  variant?: "row" | "card";
  /** Destaca o diagnóstico recém-enviado no retorno pós-envio. */
  highlighted?: boolean;
};

const ORIENTATION_TONE_CLASS = {
  success: "rounded-lg bg-brand px-3.5 py-2.5 text-sm font-medium leading-snug text-white",
  warning: "rounded-lg bg-amber-500 px-3.5 py-2.5 text-sm font-medium leading-snug text-white",
  danger: "rounded-lg bg-rose-600 px-3.5 py-2.5 text-sm font-medium leading-snug text-white",
  neutral: "rounded-lg bg-slate-100 px-3.5 py-2.5 text-sm font-medium leading-snug text-slate-700",
} as const;

export function RespondentFormProgressItem({
  form,
  variant: _variant = "row",
  highlighted = false,
  contextYear,
}: Props) {
  const presentation = getRespondentFormPresentation(form, { contextYear });
  const title = form.formName || "Formulário";

  const body = (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-base font-semibold leading-snug text-slate-900">{title}</p>

        <RespondentFormContext
          compact
          periodLabel={form.periodLabel}
          formVersion={form.formVersion}
          organizationName={form.organizationName}
        />
      </div>

      {presentation.showProgress && presentation.progress ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-sm text-slate-600">
            {presentation.progress.summary}
            {presentation.progress.total > 0 ? (
              <span className="ml-2 text-xs tabular-nums text-slate-400">
                {presentation.progress.percent}%
              </span>
            ) : null}
          </p>
          {presentation.progress.total > 0 ? (
            <div
              className="h-1.5 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={presentation.progress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={presentation.progress.summary}
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  presentation.statusTone === "success" ? "bg-emerald-500" : "bg-brand-500"
                }`}
                style={{ width: `${presentation.progress.percent}%` }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {presentation.description ? (
        <p
          className={ORIENTATION_TONE_CLASS[presentation.statusTone]}
          role="status"
        >
          <span className="sr-only">{presentation.statusLabel}. </span>
          {presentation.description}
        </p>
      ) : (
        <p className="sr-only">{presentation.statusLabel}</p>
      )}

      {presentation.primaryAction || presentation.secondaryAction ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5">
          {presentation.secondaryAction ? (
            <Link
              href={presentation.secondaryAction.href}
              className={`${formSurface.secondaryButtonSm} w-full sm:w-auto`}
            >
              {presentation.secondaryAction.label}
            </Link>
          ) : null}
          {presentation.primaryAction ? (
            <Link
              href={presentation.primaryAction.href}
              className={`${formSurface.primaryButtonSm} w-full sm:w-auto`}
            >
              {presentation.primaryAction.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const itemClass = `rounded-xl border bg-white p-4 shadow-card transition hover:border-slate-300 hover:shadow-card-hover sm:p-5 ${
    highlighted ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200/90"
  }`;

  return (
    <li
      className={itemClass}
      aria-label={`${title}. ${presentation.statusLabel}`}
    >
      {body}
    </li>
  );
}
