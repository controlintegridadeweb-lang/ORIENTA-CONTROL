"use client";

import { AlertCircle, AlertTriangle, Info, RotateCcw } from "lucide-react";
import { LoadingButton } from "@/shared/ui/components/loading";
import { formSurface } from "@/shared/layout/form-surface";
import type { WorkbenchFeedback } from "./workbench-types";

type Props = {
  feedback: WorkbenchFeedback;
  retrying?: boolean;
  onRetry?: () => void | Promise<void>;
};

const toneClasses = {
  error: formSurface.messageError,
  warning: formSurface.messageWarning,
  info: formSurface.messageNeutral,
} as const;

const toneIcons = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

/** Feedback persistente e contextual do preenchimento, sem duplicar toasts. */
export function WorkbenchFeedbackBanner({ feedback, retrying, onRetry }: Props) {
  const Icon = toneIcons[feedback.tone];

  return (
    <div
      role={feedback.tone === "error" ? "alert" : "status"}
      aria-live={feedback.tone === "error" ? "assertive" : "polite"}
      className={`${toneClasses[feedback.tone]} flex flex-wrap items-start justify-between gap-3`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold">{feedback.title}</p>
          {feedback.description ? (
            <p className="mt-0.5 leading-relaxed">{feedback.description}</p>
          ) : null}
        </div>
      </div>

      {feedback.retryAction && onRetry ? (
        <LoadingButton
          type="button"
          pending={Boolean(retrying)}
          pendingLabel="Tentando novamente…"
          onClick={() => void onRetry()}
          className={`${formSurface.secondaryButtonSm} shrink-0`}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Tentar novamente
        </LoadingButton>
      ) : null}
    </div>
  );
}
