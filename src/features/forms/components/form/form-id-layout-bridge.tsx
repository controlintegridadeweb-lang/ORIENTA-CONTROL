"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { FormEditShell } from "@/features/forms/components/form/form-edit-shell";
import type { FormPublicationState } from "@/features/forms/form-publication-state";
import { adminReturnPathOrFallback } from "@/shared/navigation/admin-navigation-context";

type Props = {
  formId: string;
  formName: string;
  state: FormPublicationState;
  children: ReactNode;
};

/**
 * Libera o assistente para formulários nunca publicados e usa a área de
 * gestão para versões já publicadas.
 */
export function FormIdLayoutBridge({ formId, formName, state, children }: Props) {
  const searchParams = useSearchParams();
  const backHref = adminReturnPathOrFallback(
    searchParams.get("returnTo"),
    "/admin/formularios",
  );
  if (state === "draft") {
    return <>{children}</>;
  }

  return (
    <FormEditShell
      formId={formId}
      formName={formName}
      state={state}
      backHref={backHref}
      backLabel="Lista de formulários"
    >
      {children}
    </FormEditShell>
  );
}
