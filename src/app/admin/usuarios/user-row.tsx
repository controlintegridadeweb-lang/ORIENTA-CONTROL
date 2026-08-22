"use client";

import { formatPlatformDate } from "@/shared/datetime/platform-date-time";
import { useState, useTransition, type ReactNode } from "react";
import type { AppRole } from "@/infrastructure/auth/current-user";
import { roleLabels } from "@/shared/ui/navigation";
import type { OrganizationOption } from "@/features/organizations/options";
import type { ListedUserRow } from "@/features/admin/users-service";
import { LoadingButton } from "@/shared/ui/components/loading";
import { useConfirm } from "@/shared/ui/components/confirm-dialog";
import { describeError, isNextRedirectError, notify } from "@/infrastructure/notifications/notify";
import { copyTextToClipboard } from "@/shared/browser/clipboard";
import { formSurface } from "@/shared/layout/form-surface";
import { removeUserAction, resetPasswordAction, saveUserProfileAction } from "./actions";

const cellClass = formSurface.brandTable.cell;
const headerCellClass = formSurface.brandTable.headCell;

const fieldClass = `w-full min-w-0 ${formSurface.input}`;

const saveButtonClass =
  "inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

const secondaryButtonClass =
  "inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

const dangerButtonClass =
  "inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

const EDITABLE_ROLES: AppRole[] = ["respondent"];

const DESKTOP_GRID =
  "lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(6rem,0.7fr)_minmax(6rem,0.7fr)_minmax(9rem,1fr)] lg:items-start";

function MobileField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5 lg:contents">
      <p className="text-xs font-medium text-slate-500 lg:hidden">{label}</p>
      {children}
    </div>
  );
}

export function UserRowGridHeader() {
  return (
    <div className={`hidden ${DESKTOP_GRID} items-center ${formSurface.brandTable.head}`}>
      <div className={headerCellClass}>Nome</div>
      <div className={headerCellClass}>E-mail</div>
      <div className={headerCellClass}>Organização</div>
      <div className={headerCellClass}>Perfil</div>
      <div className={headerCellClass}>Criado em</div>
      <div className={`${headerCellClass} text-right`}>Ações</div>
    </div>
  );
}

export function ReadonlyAdminRow({
  user,
  orgName,
  zebraEven,
}: {
  user: ListedUserRow;
  orgName: string | null;
  zebraEven: boolean;
}) {
  return (
    <article
      className={`space-y-3 p-4 lg:space-y-0 lg:p-0 ${DESKTOP_GRID} ${
        zebraEven ? formSurface.brandTable.rowEven : formSurface.brandTable.rowOdd
      }`}
    >
      <MobileField label="Nome">
        <div className={`${cellClass} break-words font-semibold text-slate-900 lg:px-4 lg:py-4`}>
          {user.fullName ?? "—"}
        </div>
      </MobileField>
      <MobileField label="E-mail">
        <div className={`${cellClass} break-all text-slate-600 lg:px-4 lg:py-4`}>
          {user.email ?? "—"}
        </div>
      </MobileField>
      <MobileField label="Organização">
        <div className={`${cellClass} break-words text-slate-700 lg:px-4 lg:py-4`}>
          {orgName ?? "—"}
        </div>
      </MobileField>
      <MobileField label="Perfil">
        <div className={`${cellClass} text-slate-700 lg:px-4 lg:py-4`}>
          {roleLabels[user.role]}
        </div>
      </MobileField>
      <MobileField label="Criado em">
        <div className={`${cellClass} whitespace-nowrap text-slate-600 lg:px-4 lg:py-4`}>
          {formatPlatformDate(user.createdAt, { dateStyle: "short" })}
        </div>
      </MobileField>
      <div className={`${cellClass} lg:px-4 lg:py-4 lg:text-right`}>
        <div className="flex flex-col gap-1 text-xs text-slate-400 lg:items-end">
          <span>Somente leitura</span>
          <span aria-hidden className="hidden lg:inline">
            —
          </span>
        </div>
      </div>
    </article>
  );
}

export function EditableUserRow({
  user,
  organizations,
  zebraEven,
}: {
  user: ListedUserRow;
  organizations: OrganizationOption[];
  zebraEven: boolean;
}) {
  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [organizationId, setOrganizationId] = useState(user.organizationId ?? "");
  const [isSaving, startSave] = useTransition();
  const [isResetting, startReset] = useTransition();
  const [isRemoving, startRemove] = useTransition();
  const confirm = useConfirm();

  const anyPending = isSaving || isResetting || isRemoving;
  const canRemove = EDITABLE_ROLES.includes(user.role);

  function buildBaseFormData() {
    const fd = new FormData();
    fd.set("userId", user.userId);
    return fd;
  }

  function handleSave() {
    if (anyPending) return;
    if (!email.trim()) {
      notify.warning("Informe um e-mail válido.");
      return;
    }
    if (!organizationId) {
      notify.warning("Selecione uma organização antes de salvar.");
      return;
    }
    const fd = buildBaseFormData();
    fd.set("fullName", fullName.trim());
    fd.set("email", email.trim());
    fd.set("role", user.role);
    fd.set("organizationId", organizationId);

    startSave(async () => {
      try {
        await saveUserProfileAction(fd);
        notify.success("Alterações salvas.");
      } catch (error) {
        if (isNextRedirectError(error)) throw error;
        notify.error(describeError(error, "Falha ao salvar."));
      }
    });
  }

  function handleReset() {
    if (anyPending) return;
    startReset(async () => {
      try {
        const result = await resetPasswordAction(buildBaseFormData());
        if (!result.recoveryLink) {
          notify.success(result.message);
          return;
        }

        const copied = await copyTextToClipboard(result.recoveryLink);
        if (copied) {
          notify.success(
            "O e-mail não pôde ser solicitado. O link alternativo foi copiado para a área de transferência.",
          );
          return;
        }

        notify.warning(
          "O e-mail não pôde ser solicitado. Copie o link alternativo manualmente.",
          { description: result.recoveryLink, duration: 20000 },
        );
      } catch (error) {
        if (isNextRedirectError(error)) throw error;
        notify.error(describeError(error, "Falha ao gerar link."));
      }
    });
  }

  async function handleRemove() {
    if (anyPending) return;
    if (!canRemove) return;
    const ok = await confirm({
      title: "Remover usuário?",
      description: `${user.email ?? "Este usuário"} perderá o acesso. Esta ação é irreversível.`,
      confirmLabel: "Remover",
      tone: "danger",
    });
    if (!ok) return;
    startRemove(async () => {
      try {
        await removeUserAction(buildBaseFormData());
      } catch (error) {
        if (isNextRedirectError(error)) throw error;
        notify.error(describeError(error, "Falha ao remover."));
      }
    });
  }

  return (
    <article
      className={`space-y-3 p-4 lg:space-y-0 lg:p-0 ${DESKTOP_GRID} ${
        zebraEven ? formSurface.brandTable.rowEven : formSurface.brandTable.rowOdd
      }`}
    >
      <MobileField label="Nome">
        <div className={`${cellClass} lg:px-4 lg:py-4`}>
          <input
            name="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nome completo"
            className={fieldClass}
            disabled={anyPending}
            aria-label="Nome completo"
          />
        </div>
      </MobileField>

      <MobileField label="E-mail">
        <div className={`${cellClass} lg:px-4 lg:py-4`}>
          <input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e-mail@org.gov.br"
            className={fieldClass}
            disabled={anyPending}
            required
            autoComplete="off"
            aria-label="E-mail"
          />
        </div>
      </MobileField>

      <MobileField label="Organização">
        <div className={`${cellClass} lg:px-4 lg:py-4`}>
          <select
            name="organizationId"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            className={fieldClass}
            disabled={anyPending}
            required
            aria-label="Organização"
          >
            <option value="" disabled>
              Selecione…
            </option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      </MobileField>

      <MobileField label="Perfil">
        <div className={`${cellClass} text-slate-700 lg:px-4 lg:py-4`}>
          <span className="inline-flex min-h-11 items-center">{roleLabels[user.role]}</span>
        </div>
      </MobileField>

      <MobileField label="Criado em">
        <div className={`${cellClass} whitespace-nowrap text-slate-600 lg:px-4 lg:py-4`}>
          {formatPlatformDate(user.createdAt, { dateStyle: "short" })}
        </div>
      </MobileField>

      <div className={`${cellClass} lg:px-4 lg:py-4 lg:text-right`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-col lg:items-end">
          <LoadingButton
            onClick={handleSave}
            disabled={anyPending && !isSaving}
            pending={isSaving}
            pendingLabel="Salvando…"
            className={saveButtonClass}
          >
            Salvar
          </LoadingButton>
          <LoadingButton
            onClick={handleReset}
            disabled={anyPending && !isResetting}
            pending={isResetting}
            pendingLabel="Gerando link…"
            className={secondaryButtonClass}
          >
            Resetar senha
          </LoadingButton>
          {canRemove ? (
            <LoadingButton
              onClick={() => void handleRemove()}
              disabled={anyPending && !isRemoving}
              pending={isRemoving}
              pendingLabel="Removendo…"
              className={dangerButtonClass}
            >
              Remover
            </LoadingButton>
          ) : (
            <span className="hidden text-xs text-slate-400 lg:inline">—</span>
          )}
        </div>
      </div>
    </article>
  );
}
