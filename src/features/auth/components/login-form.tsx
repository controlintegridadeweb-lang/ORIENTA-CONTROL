"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { AlertCircle } from "lucide-react";
import type { AuthFormState } from "@/features/auth/server-actions";
import { safePostLoginRedirect } from "@/infrastructure/auth/safe-redirect";
import { AuthGlassCard } from "@/features/auth/components/auth-glass-card";
import {
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  authAlertClass,
} from "@/features/auth/components/auth-field-classes";
import { LoadingButton } from "@/shared/ui/components/loading";
import { typography } from "@/shared/layout/design-system";
import { apiErrorSchema, buildHeaders, parseJson } from "@/infrastructure/api/fetch-client";

const defaultAuthFormState: AuthFormState = { status: "idle" };

const signInSuccessSchema = z
  .object({
    role: z.enum(["admin", "respondent"]),
    requiresMfa: z.boolean(),
  })
  .passthrough();

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [state, setState] = useState<AuthFormState>(defaultAuthFormState);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState(defaultAuthFormState);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const requestedRedirect = String(formData.get("redirect") ?? "").trim();

    if (!email || !password) {
      setState({ status: "error", message: "Informe e-mail e senha para entrar." });
      setPending(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const payload = await parseJson(response, apiErrorSchema);
        setState({
          status: "error",
          message: payload.error ?? "E-mail ou senha inválidos.",
        });
        return;
      }

      const payload = await parseJson(response, signInSuccessSchema);
      const destination = safePostLoginRedirect(requestedRedirect, payload.role);
      if (payload.role === "admin" && payload.requiresMfa) {
        router.replace(`/auth/mfa?redirect=${encodeURIComponent(destination)}`);
        router.refresh();
        return;
      }

      router.replace(destination);
      router.refresh();
    } catch {
      setState({
        status: "error",
        message: "Não foi possível entrar. Tente novamente.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthGlassCard>
      <header className="mb-10 space-y-2">
        <p className={typography.panelEyebrow}>Plataforma Orienta</p>
        <h1 className={`text-balance ${typography.pageTitle}`}>Entrar na conta</h1>
        <p className={`max-w-lg text-pretty ${typography.pageDescription}`}>
          Informe o e-mail e a senha fornecidos pelo administrador.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {redirectTo ? <input type="hidden" name="redirect" value={redirectTo} /> : null}

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

        <div className="space-y-2">
          <label htmlFor="password" className={AUTH_LABEL_CLASS}>
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Digite sua senha"
            className={AUTH_INPUT_CLASS}
          />
        </div>

        <div className="flex justify-end pt-1">
          <Link
            href="/auth/forgot-password"
            className="text-base font-medium text-brand-800 underline decoration-brand-800/30 underline-offset-1 transition hover:text-brand-900 hover:decoration-brand-900/50 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          >
            Esqueci minha senha
          </Link>
        </div>

        {state.status === "error" && state.message ? (
          <div className={`flex gap-3 ${authAlertClass("error")}`} role="alert">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden />
            <span>{state.message}</span>
          </div>
        ) : null}

        {state.status === "success" && state.message ? (
          <div className={`flex gap-3 ${authAlertClass("success")}`} role="status">
            <span>{state.message}</span>
          </div>
        ) : null}

        <LoadingButton
          type="submit"
          pending={pending}
          pendingLabel="Entrando…"
          spinnerSize="lg"
          className={`${AUTH_PRIMARY_BUTTON_CLASS} mt-2`}
        >
          Entrar na plataforma
        </LoadingButton>
      </form>
    </AuthGlassCard>
  );
}
