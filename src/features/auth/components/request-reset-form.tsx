"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { requestPasswordResetAction, type AuthFormState } from "@/features/auth/server-actions";
import {
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  authAlertClass,
} from "@/features/auth/components/auth-field-classes";
import { LoadingButton } from "@/shared/ui/components/loading";

const defaultAuthFormState: AuthFormState = { status: "idle" };

export function RequestResetForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, defaultAuthFormState);

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="email" className={AUTH_LABEL_CLASS}>
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="nome@exemplo.org"
          className={AUTH_INPUT_CLASS}
        />
      </div>

      {state.status !== "idle" && state.message ? (
        <div
          role="alert"
          className={`flex gap-3 ${authAlertClass(state.status === "success" ? "success" : "error")}`}
        >
          {state.status === "success" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden />
          )}
          <span>{state.message}</span>
        </div>
      ) : null}

      <LoadingButton
        type="submit"
        pending={pending}
        pendingLabel="Enviando…"
        spinnerSize="lg"
        className={AUTH_PRIMARY_BUTTON_CLASS}
      >
        Enviar link de recuperação
      </LoadingButton>
    </form>
  );
}
