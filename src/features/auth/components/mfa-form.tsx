"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser";
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
import {
  MfaFlowError,
  prepareAdminMfaSetup,
  userMessageForMfaError,
  verifyAdminMfaCode,
  type MfaSetup,
} from "@/features/auth/mfa-enrollment";

type BrowserClient = ReturnType<typeof createSupabaseBrowserClient>;

function toUserError(error: unknown): string {
  if (error instanceof MfaFlowError) {
    return error.message;
  }
  return userMessageForMfaError("unexpected");
}

export function MfaForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const clientRef = useRef<BrowserClient | null>(null);
  const generationRef = useRef(0);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function client(): BrowserClient {
    if (!clientRef.current) clientRef.current = createSupabaseBrowserClient();
    return clientRef.current;
  }

  const executePrepare = useCallback(async (generation: number) => {
    try {
      const nextSetup = await prepareAdminMfaSetup(client());
      if (generationRef.current !== generation) return;

      if (nextSetup.mode === "challenge" || nextSetup.mode === "enroll") {
        setSetup(nextSetup);
      }
    } catch (prepareError) {
      if (generationRef.current !== generation) return;
      if (
        prepareError instanceof MfaFlowError &&
        prepareError.code === "already_configured"
      ) {
        router.replace(safePostLoginRedirect(redirectTo, "admin"));
        router.refresh();
        return;
      }
      setError(toUserError(prepareError));
    } finally {
      if (generationRef.current === generation) {
        setLoading(false);
      }
    }
  }, [redirectTo, router]);

  const prepare = useCallback(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setLoading(true);
    setError(null);
    setSetup(null);
    setCode("");
    void executePrepare(generation);
  }, [executePrepare]);

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    void executePrepare(generation);
    return () => {
      generationRef.current += 1;
    };
  }, [executePrepare]);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!setup || pending) return;

    if (!/^\d{6}$/.test(code)) {
      setError("Informe o código de seis dígitos do aplicativo autenticador.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await verifyAdminMfaCode(client(), {
        factorId: setup.factorId,
        code,
      });
      router.replace(safePostLoginRedirect(redirectTo, "admin"));
      router.refresh();
    } catch (verifyError) {
      setError(toUserError(verifyError));
    } finally {
      setPending(false);
    }
  }

  const hasExistingAuthenticator = setup?.mode === "challenge";
  const canRetry = !loading && !setup && Boolean(error);

  return (
    <AuthGlassCard>
      <header className="mb-8 space-y-3">
        <div className="flex items-center gap-2 text-brand-800">
          <ShieldCheck className="h-5 w-5" aria-hidden />
          <span className="font-medium">Segurança administrativa</span>
        </div>
        <h1 className={typography.pageTitle}>Autenticação em duas etapas</h1>
        <p className={typography.pageDescription}>
          A área administrativa exige um código temporário além da senha.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-slate-600">Preparando autenticação segura…</p>
      ) : null}

      {!loading && setup ? (
        <form onSubmit={verify} className="space-y-5">
          {setup.mode === "enroll" ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-800">
                Cadastre no aplicativo autenticador
              </p>
              {/* QR dinâmico em data URL gerado pelo Supabase Auth. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={setup.qrCode}
                alt="QR Code para cadastrar autenticação em duas etapas"
                className="mx-auto h-48 w-48 rounded-lg bg-white p-2"
              />
              <p className="break-all text-xs text-slate-600">
                <strong>Chave manual:</strong> {setup.secret}
              </p>
            </div>
          ) : (
            <div className={`flex gap-3 ${authAlertClass("success")}`} role="status">
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"
                aria-hidden
              />
              <span>Use o autenticador já cadastrado para confirmar o acesso.</span>
            </div>
          )}

          <label className="block space-y-2" htmlFor="mfa-code">
            <span className={AUTH_LABEL_CLASS}>Código de seis dígitos</span>
            <input
              id="mfa-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              disabled={pending}
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className={AUTH_INPUT_CLASS}
            />
          </label>

          {error ? (
            <div className={`flex gap-3 ${authAlertClass("error")}`} role="alert">
              <AlertCircle
                className="mt-0.5 h-5 w-5 shrink-0 text-rose-700"
                aria-hidden
              />
              <span>{error}</span>
            </div>
          ) : null}

          <LoadingButton
            type="submit"
            pending={pending}
            disabled={pending || code.length !== 6}
            pendingLabel="Verificando…"
            className={AUTH_PRIMARY_BUTTON_CLASS}
          >
            Confirmar acesso
          </LoadingButton>

          {hasExistingAuthenticator ? (
            <div className="space-y-2 border-t border-slate-200 pt-4">
              <p className="text-sm font-medium text-slate-800">
                Perdeu o acesso ao autenticador?
              </p>
              <p className="text-sm text-slate-600">
                Por segurança, o segundo fator não pode ser removido pela própria
                sessão protegida apenas por senha. Solicite ao responsável técnico autorizado
                a recuperação do MFA pelo procedimento operacional
                documentado, com simulação prévia, registro append-only e
                confirmação de identidade por canal independente.
              </p>
            </div>
          ) : null}
        </form>
      ) : null}

      {!loading && !setup && error ? (
        <div className="space-y-4">
          <div className={`flex gap-3 ${authAlertClass("error")}`} role="alert">
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-rose-700"
              aria-hidden
            />
            <span>{error}</span>
          </div>
          {canRetry ? (
            <LoadingButton
              type="button"
              pending={loading}
              pendingLabel="Preparando…"
              className={AUTH_PRIMARY_BUTTON_CLASS}
              onClick={() => {
                void prepare();
              }}
            >
              Tentar novamente
            </LoadingButton>
          ) : null}
        </div>
      ) : null}
    </AuthGlassCard>
  );
}
