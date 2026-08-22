"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser";
import { MIN_PASSWORD_LENGTH, validatePassword } from "@/infrastructure/auth/password-policy";
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
      clientRef.current = createSupabaseBrowserClient();
    }
    return clientRef.current;
  }

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const client = getClient();
    const tokenHash = currentUrl.searchParams.get("token_hash");
    const otpType = currentUrl.searchParams.get("type");
    const code = currentUrl.searchParams.get("code");

    function clearAuthParamsFromUrl() {
      window.history.replaceState({}, "", currentUrl.pathname);
    }

    // Link gerado no admin (generateLink): PKCE não tem code_verifier no browser.
    if (tokenHash && otpType === "recovery") {
      void client.auth
        .verifyOtp({ token_hash: tokenHash, type: "recovery" })
        .then(({ error }) => {
          if (error) {
            setStatus("error");
            setMessage("Link de recuperação inválido ou expirado.");
            return;
          }
          clearAuthParamsFromUrl();
        });
      return;
    }

    if (code) {
      void client.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          setStatus("error");
          setMessage("Link de recuperação inválido ou expirado.");
          return;
        }
        clearAuthParamsFromUrl();
      });
      return;
    }

    // Fluxo legado (implicit): tokens vêm no hash (#access_token&type=recovery).
    const hash = currentUrl.hash.replace(/^#/, "");
    if (!hash) return;
    const params = new URLSearchParams(hash);
    if (params.get("type") !== "recovery" && !params.get("access_token")) return;

    void client.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        setStatus("error");
        setMessage("Link de recuperação inválido ou expirado.");
      }
    });
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

      {status !== "idle" && message ? (
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
        pending={pending}
        pendingLabel="Atualizando…"
        spinnerSize="lg"
        className={AUTH_PRIMARY_BUTTON_CLASS}
      >
        Salvar nova senha
      </LoadingButton>
    </form>
  );
}
