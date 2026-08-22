"use client";

import { Check } from "lucide-react";
import {
  FORM_WIZARD_STEPS,
  wizardStepStatus,
  type FormWizardStepId,
  type WizardStepStatus,
} from "./form-wizard-steps";

type Props = {
  currentStep: FormWizardStepId;
  maxReachableStep: FormWizardStepId;
  onStepSelect?: (step: FormWizardStepId) => void;
};

const CIRCLE: Record<WizardStepStatus, string> = {
  current: "bg-brand text-white shadow-sm ring-4 ring-brand-100",
  complete: "bg-brand text-white",
  available: "border-2 border-brand-300 bg-white text-brand-800",
  locked: "border-2 border-slate-200 bg-white text-slate-400",
};

const LABEL: Record<WizardStepStatus, string> = {
  current: "font-semibold text-brand-800",
  complete: "font-medium text-slate-700",
  available: "font-medium text-slate-600",
  locked: "font-medium text-slate-400",
};

export function FormWizardStepper({ currentStep, maxReachableStep, onStepSelect }: Props) {
  return (
    <nav
      aria-label="Etapas do formulário"
      className="w-full min-w-0 border-y border-brand-100/80 bg-brand-50/60 px-4 py-7 sm:px-6 md:px-7"
    >
      <ol className="flex w-full items-start">
        {FORM_WIZARD_STEPS.map((step, index) => {
          const status = wizardStepStatus(step.id, currentStep, maxReachableStep);
          const reachable = status !== "locked";
          const selectable = Boolean(reachable && onStepSelect);
          const isLast = index === FORM_WIZARD_STEPS.length - 1;
          const connectorDone = step.id < currentStep;

          return (
            <li key={step.id} className="relative flex min-w-0 flex-1 flex-col items-center">
              {isLast ? null : (
                <span
                  aria-hidden
                  className={`absolute top-6 left-1/2 z-0 h-1 w-full rounded-full ${
                    connectorDone ? "bg-brand" : "bg-slate-200"
                  }`}
                />
              )}
              <button
                type="button"
                disabled={!selectable}
                onClick={() => onStepSelect?.(step.id)}
                className={[
                  "group relative z-1 flex min-h-12 w-full min-w-0 flex-col items-center gap-2.5 rounded-lg px-1 text-center",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  selectable ? "cursor-pointer" : "cursor-default",
                ].join(" ")}
                aria-current={status === "current" ? "step" : undefined}
                aria-label={status === "complete" ? `${step.label} (concluída)` : step.label}
              >
                <span
                  className={[
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-semibold transition",
                    CIRCLE[status],
                    selectable && status === "complete" ? "group-hover:bg-brand-500" : "",
                    selectable && status === "available"
                      ? "group-hover:border-brand group-hover:bg-brand-50"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {status === "complete" ? <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden /> : step.id}
                </span>
                <span className={`block max-w-full text-xs leading-snug sm:text-sm ${LABEL[status]}`}>
                  {step.shortLabel}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
