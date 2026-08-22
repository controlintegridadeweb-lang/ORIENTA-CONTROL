"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { z } from "zod";
import { Building2, CheckCircle2, Mail } from "lucide-react";
import { LoadingButton } from "@/shared/ui/components/loading";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { ProfileContentLayout } from "@/features/profile/components/profile-content-layout";
import { parseJson } from "@/infrastructure/api/fetch-client";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser";
import type { CurrentUser } from "@/infrastructure/auth/current-user";
import { MIN_PASSWORD_LENGTH, validatePassword } from "@/infrastructure/auth/password-policy";
import { typography } from "@/shared/layout/design-system";
import { formSurface } from "@/shared/layout/form-surface";

type BrowserClient = ReturnType<typeof createSupabaseBrowserClient>;

const profileUpdateResponseSchema = z.object({
  error: z.unknown().optional(),
  profile: z.object({
    fullName: z.string().nullable(),
    preferences: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
}).passthrough();

function FieldAlert({
  type,
  text,
}: {
  type: "success" | "error";
  text: string;
}) {
  return (
    <div
      role="alert"
      className={type === "success" ? formSurface.messageSuccess : formSurface.messageError}
    >
      {type === "success" ? (
        <span className="inline-flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{text}</span>
        </span>
      ) : (
        text
      )}
    </div>
  );
}

function ReadOnlyFact({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className={formSurface.subtlePanel}>
      <dt className={`flex items-center gap-2 ${formSurface.label}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="mt-1.5 text-sm font-medium text-slate-900">{value}</dd>
      {hint ? <p className={`mt-1 ${typography.meta}`}>{hint}</p> : null}
    </div>
  );
}

export function ProfileEditForm({ user }: { user: CurrentUser }) {
  const router = useRouter();
  // Client criado preguiçosamente (browser-only): evita instanciar durante o
  // render no servidor/prerender, onde as envs públicas não existem.
  const supabaseRef = useRef<BrowserClient | null>(null);
  function getSupabase(): BrowserClient {
    if (!supabaseRef.current) {
      supabaseRef.current = createSupabaseBrowserClient();
    }
    return supabaseRef.current;
  }
  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName }),
    });
    let data: z.infer<typeof profileUpdateResponseSchema>;
    try {
      data = await parseJson(res, profileUpdateResponseSchema);
    } catch {
      setSaving(false);
      setMessage({
        type: "error",
        text: "O servidor retornou uma resposta inválida. Tente novamente.",
      });
      return;
    }
    setSaving(false);
    if (!res.ok) {
      setMessage({
        type: "error",
        text:
          typeof data.error === "string"
            ? data.error
            : "Não foi possível salvar. Tente de novo.",
      });
      return;
    }
    if (data.profile) {
      setFullName(data.profile.fullName ?? "");
    }
    setMessage({ type: "success", text: "Alterações salvas com sucesso." });
    router.refresh();
  }

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    const email = user.email;
    if (!email) {
      setPasswordMessage({
        type: "error",
        text: "Não foi possível identificar o e-mail da conta. Contate o administrador.",
      });
      return;
    }

    setPasswordMessage(null);

    const policy = validatePassword(newPassword, "A nova senha");
    if (!policy.ok) {
      setPasswordMessage({ type: "error", text: policy.message });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordMessage({ type: "error", text: "As senhas novas não conferem." });
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordMessage({ type: "error", text: "A nova senha deve ser diferente da atual." });
      return;
    }

    setSavingPassword(true);
    const { error: signInError } = await getSupabase().auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (signInError) {
      setSavingPassword(false);
      setPasswordMessage({ type: "error", text: "Senha atual incorreta." });
      return;
    }

    const { error: updateError } = await getSupabase().auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (updateError) {
      setPasswordMessage({
        type: "error",
        text: "Não foi possível atualizar a senha. Tente de novo.",
      });
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setPasswordMessage({ type: "success", text: "Senha atualizada com sucesso." });
    router.refresh();
  }

  return (
    <ProfileContentLayout>
      <PanelSection
        title="Dados da conta"
        description="O nome aparece no menu lateral. E-mail e organização vêm do cadastro administrativo."
        variant="plain"
      >
        <div className={`${formSurface.dashboardPanel} ${formSurface.dashboardPanelPadding}`}>
          <form onSubmit={onSubmit} className="space-y-6">
            {message ? <FieldAlert type={message.type} text={message.text} /> : null}

            <dl className="space-y-3">
              <ReadOnlyFact
                icon={Mail}
                label="E-mail"
                value={user.email ?? "—"}
                hint="Para alterar o e-mail, fale com o administrador da plataforma."
              />
              {user.organizationName || user.organizationId ? (
                <ReadOnlyFact
                  icon={Building2}
                  label="Organização"
                  value={user.organizationName ?? "—"}
                />
              ) : null}
            </dl>

            <div className={formSurface.fieldGroup}>
              <label htmlFor="fullName" className={formSurface.label}>
                Nome completo
              </label>
              <p className={typography.meta}>Como deseja ser identificado na plataforma.</p>
              <input
                id="fullName"
                name="fullName"
                className={formSurface.input}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={500}
                placeholder="Seu nome completo"
                autoComplete="name"
              />
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
              <LoadingButton
                type="submit"
                pending={saving}
                pendingLabel="Salvando alterações…"
                className={formSurface.primaryButton}
              >
                Salvar alterações
              </LoadingButton>
            </div>
          </form>
        </div>
      </PanelSection>

      {user.email ? (
        <PanelSection
          title="Senha de acesso"
          description="Atualize sua senha. Se não lembrar a senha atual, use a recuperação por e-mail."
          variant="plain"
        >
          <div className={`${formSurface.dashboardPanel} ${formSurface.dashboardPanelPadding}`}>
            <form onSubmit={onPasswordSubmit} className="space-y-5">
              {passwordMessage ? (
                <FieldAlert type={passwordMessage.type} text={passwordMessage.text} />
              ) : null}

              <div className={formSurface.fieldGroup}>
                <label htmlFor="currentPassword" className={formSurface.label}>
                  Senha atual
                </label>
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  required
                  autoComplete="current-password"
                  className={formSurface.input}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div className={formSurface.fieldGroup}>
                <label htmlFor="newPassword" className={formSurface.label}>
                  Nova senha
                </label>
                <p className={typography.meta}>
                  Mínimo de {MIN_PASSWORD_LENGTH} caracteres, com maiúscula, minúscula, número e
                  símbolo.
                </p>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  className={formSurface.input}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className={formSurface.fieldGroup}>
                <label htmlFor="confirmNewPassword" className={formSurface.label}>
                  Confirmar nova senha
                </label>
                <input
                  id="confirmNewPassword"
                  name="confirmNewPassword"
                  type="password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  className={formSurface.input}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <LoadingButton
                  type="submit"
                  pending={savingPassword}
                  pendingLabel="Atualizando senha…"
                  className={formSurface.primaryButton}
                >
                  Atualizar senha
                </LoadingButton>
                <Link
                  href="/auth/forgot-password"
                  className="text-center text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 transition hover:text-slate-900 hover:decoration-slate-500 sm:text-left"
                >
                  Esqueci minha senha
                </Link>
              </div>
            </form>
          </div>
        </PanelSection>
      ) : null}
    </ProfileContentLayout>
  );
}
