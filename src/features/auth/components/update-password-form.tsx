"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser";
import { MIN_PASSWORD_LENGTH, validatePassword } from "@/infrastructure/auth/password-policy";
import {
  readRecoveryCallback,
  RECOVERY_LINK_INVALID,
  RECOVERY_LINK_MISSING,
} from "@/features/auth/recovery-callback";
import {
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  authAlertClass,
} from "@/features/auth/components/auth-field-classes";
import { LoadingButton } from "@/shared/ui/components/loading";

type BrowserClient = ReturnType<typeof createSupabaseBrowserClient>;

export function UpdatePasswordForm() {
  // O client do Supabase só pode existir no browser (precisa das envs públicas e
  // de `window`). Criar via `useMemo`/no corpo do componente executaria durante o
  // prerender no servidor e quebraria o build. Aqui ele é criado preguiçosamente,
  // só dentro de efeitos/handlers (client-only).
  const clientRef = useRef<BrowserClient | null>(null);
  function getClient(): BrowserClient {
    if (!clientRef.current) {
      // A sessão do e-mail vem no fragmento. A detecção automática do cliente
      // PKCE rejeita esse formato e concorreria com setSession.
      clientRef.current = createSupabaseBrowserClient({
        detectSessionInUrl: false,
        lock: async (_name, _acquireTimeout, fn) => fn(),
      });
    }
    return clientRef.current;
  }

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"checking" | "idle" | "error" | "success">("checking");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const callback = readRecoveryCallback(window.location.href);
    const client = getClient();

    function clearAuthParamsFromUrl() {
      window.history.replaceState({}, "", window.location.pathname);
    }

    async function establishRecoverySession() {
      if (callback.kind === "error") {
        setStatus("error");
        setMessage(callback.message);
        return;
      }

      if (callback.kind === "otp") {
        const { error } = await client.auth.verifyOtp({
          token_hash: callback.tokenHash,
          type: "recovery",
        });
        if (error) {
          setStatus("error");
          setMessage(RECOVERY_LINK_INVALID);
          return;
        }
        clearAuthParamsFromUrl();
        setStatus("idle");
        return;
      }

      if (callback.kind === "session") {
        const { error } = await client.auth.setSession({
          access_token: callback.accessToken,
          refresh_token: callback.refreshToken,
        });
        if (error) {
          setStatus("error");
          setMessage(RECOVERY_LINK_INVALID);
          return;
        }
        clearAuthParamsFromUrl();
        setStatus("idle");
        return;
      }

      if (callback.kind === "code") {
        const exchanged = await client.auth.exchangeCodeForSession(callback.code);
        if (exchanged.error) {
          const existing = await client.auth.getSession();
          if (!existing.data.session) {
            setStatus("error");
            setMessage(RECOVERY_LINK_INVALID);
            return;
          }
        }
        clearAuthParamsFromUrl();
        setStatus("idle");
        return;
      }

      const existing = await client.auth.getSession();
      if (!existing.data.session) {
        setStatus("error");
        setMessage(RECOVERY_LINK_MISSING);
        return;
      }
      setStatus("idle");
    }

    void establishRecoverySession();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("idle");
    setMessage("");

    const policy = validatePassword(password);
    if (!policy.ok) {
      setStatus("error");
      setMessage(policy.message);
      return;
    }

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("As senhas não conferem.");
      return;
    }

    setPending(true);
    const { error } = await getClient().auth.updateUser({ password });
    setPending(false);

    if (error) {
      setStatus("error");
      setMessage("Não foi possível redefinir a senha.");
      return;
    }

    setStatus("success");
    setMessage("Senha atualizada com sucesso. Volte ao login para entrar.");
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="password" className={AUTH_LABEL_CLASS}>
          Nova senha
        </label>
        <p className="text-sm leading-relaxed text-slate-500">Mínimo de {MIN_PASSWORD_LENGTH} caracteres, com maiúscula, minúscula, número e símbolo.</p>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          placeholder="••••••••"
          className={AUTH_INPUT_CLASS}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="confirmPassword" className={AUTH_LABEL_CLASS}>
          Confirmar nova senha
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          placeholder="••••••••"
          className={AUTH_INPUT_CLASS}
        />
      </div>

      {status !== "idle" && status !== "checking" && message ? (
        <div role="alert" className={`flex gap-3 ${authAlertClass(status === "success" ? "success" : "error")}`}>
          {status === "success" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden />
          )}
          <span>{message}</span>
        </div>
      ) : null}

      <LoadingButton
        type="submit"
        pending={pending || status === "checking"}
        pendingLabel={status === "checking" ? "Validando link…" : "Atualizando…"}
        spinnerSize="lg"
        className={AUTH_PRIMARY_BUTTON_CLASS}
      >
        Salvar nova senha
      </LoadingButton>
    </form>
  );
}
