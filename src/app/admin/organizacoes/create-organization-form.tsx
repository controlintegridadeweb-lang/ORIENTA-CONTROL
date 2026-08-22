"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { LoadingButton } from "@/shared/ui/components/loading";
import { notify } from "@/infrastructure/notifications/notify";
import { formSurface } from "@/shared/layout/form-surface";
import { createOrganizationAction, type OrgActionState } from "./actions";

const initialState: OrgActionState = { status: "idle" };

export function CreateOrganizationForm() {
  const [state, formAction, pending] = useActionState(
    createOrganizationAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const lastHandled = useRef<OrgActionState>(initialState);

  useEffect(() => {
    if (state === lastHandled.current) return;
    lastHandled.current = state;
    if (state.status === "success") {
      notify.success(state.message ?? "Organização cadastrada.");
      formRef.current?.reset();
    } else if (state.status === "error") {
      notify.error(state.message ?? "Não foi possível cadastrar.");
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className={`min-w-0 flex-1 ${formSurface.fieldGroup}`}>
        <label htmlFor="org-name" className={formSurface.label}>
          Nome da organização
        </label>
        <input
          id="org-name"
          name="name"
          type="text"
          required
          minLength={3}
          maxLength={160}
          placeholder="Ex.: Secretaria de Estado da Administração"
          className={formSurface.input}
          autoComplete="off"
        />
      </div>
      <div className={`w-full min-w-0 sm:w-36 ${formSurface.fieldGroup}`}>
        <label htmlFor="org-acronym" className={formSurface.label}>
          Sigla
        </label>
        <input
          id="org-acronym"
          name="acronym"
          type="text"
          required
          minLength={2}
          maxLength={12}
          placeholder="Ex.: SEAD"
          className={formSurface.input}
          autoComplete="off"
        />
      </div>
      <LoadingButton
        type="submit"
        pending={pending}
        className={formSurface.primaryButton}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Cadastrar
      </LoadingButton>
    </form>
  );
}
