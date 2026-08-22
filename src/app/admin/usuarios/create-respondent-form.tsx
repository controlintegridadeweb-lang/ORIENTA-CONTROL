"use client";

import { useActionState, useEffect, useRef } from "react";
import { UserPlus } from "lucide-react";
import { LoadingButton } from "@/shared/ui/components/loading";
import { notify } from "@/infrastructure/notifications/notify";
import { formSurface } from "@/shared/layout/form-surface";
import type { OrganizationOption } from "@/features/organizations/options";
import { createRespondentAction, type CreateRespondentState } from "./actions";

const initialState: CreateRespondentState = { status: "idle" };

export function CreateRespondentForm({
  organizations,
}: {
  organizations: OrganizationOption[];
}) {
  const [state, formAction, pending] = useActionState(
    createRespondentAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const lastHandled = useRef<CreateRespondentState>(initialState);

  useEffect(() => {
    if (state === lastHandled.current) return;
    lastHandled.current = state;
    if (state.status === "success") {
      notify.success(state.message ?? "Respondente criado.");
      formRef.current?.reset();
    } else if (state.status === "error") {
      notify.error(state.message ?? "Não foi possível criar o respondente.");
    }
  }, [state]);

  const noOrganizations = organizations.length === 0;
  const lastRecoveryLink = state.status === "success" ? (state.recoveryLink ?? null) : null;
  const accessMethod = state.status === "success" ? state.accessMethod : undefined;

  return (
    <div className="space-y-4">
      {noOrganizations ? (
        <div className={formSurface.messageWarning}>
          Cadastre ao menos uma organização antes de criar respondentes — respondentes
          precisam de uma organização vinculada.
        </div>
      ) : null}

      <form
        ref={formRef}
        action={formAction}
        className="grid gap-3 sm:grid-cols-2"
      >
        <div className={formSurface.fieldGroup}>
          <label htmlFor="resp-email" className={formSurface.label}>
            E-mail
          </label>
          <input
            id="resp-email"
            name="email"
            type="email"
            required
            placeholder="responsavel@organizacao.gov.br"
            className={formSurface.input}
            autoComplete="off"
          />
        </div>

        <div className={formSurface.fieldGroup}>
          <label htmlFor="resp-name" className={formSurface.label}>
            Nome (opcional)
          </label>
          <input
            id="resp-name"
            name="fullName"
            type="text"
            maxLength={160}
            placeholder="Nome do respondente"
            className={formSurface.input}
            autoComplete="off"
          />
        </div>

        <div className={formSurface.fieldGroup}>
          <label htmlFor="resp-org" className={formSurface.label}>
            Organização
          </label>
          <select
            id="resp-org"
            name="organizationId"
            required
            defaultValue=""
            className={formSurface.input}
            disabled={noOrganizations}
          >
            <option value="" disabled>
              Selecione…
            </option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        <div className={formSurface.fieldGroup}>
          <label htmlFor="resp-password" className={formSurface.label}>
            Senha provisória (opcional)
          </label>
          <input
            id="resp-password"
            name="password"
            type="password"
            minLength={12}
            placeholder="Deixe em branco para gerar link de definição"
            className={formSurface.input}
            autoComplete="off"
          />
        </div>

        <div className="sm:col-span-2">
          <LoadingButton
            type="submit"
            pending={pending}
            disabled={noOrganizations}
            className={formSurface.primaryButton}
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            Criar respondente
          </LoadingButton>
        </div>
      </form>

      {accessMethod === "email" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          A solicitação de definição de senha foi aceita pelo provedor de e-mail.
        </div>
      ) : null}

      {accessMethod === "temporary_password" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          A conta foi criada com a senha provisória informada. Oriente o respondente a entrar com essa senha e alterá-la após o primeiro acesso.
        </div>
      ) : null}

      {lastRecoveryLink ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          <p className="font-semibold">Link de definição de senha</p>
          <p className="mt-1 break-all font-mono text-xs">{lastRecoveryLink}</p>
          <p className="mt-2 text-xs text-sky-900">
            Envie este link ao respondente por um canal seguro. Ele é exibido apenas nesta sessão e não fica armazenado na fila de importação.
          </p>
        </div>
      ) : null}

    </div>
  );
}
