"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  deleteSuspendedForm,
  unpublishSuspendedForm,
} from "@/features/cycles";
import { formManagementUi } from "@/features/forms/components/form/form-management-ui";
import { FormManagementSection } from "@/features/forms/components/form/form-tab-panel";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import { formSurface } from "@/shared/layout/form-surface";
import { useConfirm } from "@/shared/ui/components/confirm-dialog";
import { LoadingButton } from "@/shared/ui/components/loading";

export function PublishedFormWithdrawal({
  formId,
  canWithdraw,
}: {
  formId: string;
  canWithdraw: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [justification, setJustification] = useState("");
  const [pending, setPending] = useState<"unpublish" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const manageHref = `/admin/ciclos/gestao?formId=${encodeURIComponent(formId)}`;

  async function run(action: "unpublish" | "delete") {
    if (!canWithdraw || pending) return;
    if (justification.trim().length < 10) {
      setError("Informe uma justificativa com pelo menos 10 caracteres.");
      return;
    }
    const confirmed = await confirm({
      title: action === "delete" ? "Excluir formulário?" : "Despublicar formulário?",
      description:
        action === "delete"
          ? "O formulário e os diagnósticos, respostas, evidências e relatórios ligados a ele serão removidos de forma definitiva."
          : "O formulário deixa de estar publicado e volta a rascunho. Os diagnósticos já abertos permanecem, com a coleta suspensa.",
      confirmLabel: action === "delete" ? "Excluir" : "Despublicar",
      cancelLabel: "Cancelar",
      tone: action === "delete" ? "danger" : "default",
    });
    if (!confirmed) return;

    setPending(action);
    setError(null);
    try {
      if (action === "unpublish") {
        await unpublishSuspendedForm({ formId, justification });
        notify.success("Formulário despublicado.");
        router.refresh();
        return;
      }
      await deleteSuspendedForm({ formId, justification });
      notify.success("Formulário excluído.");
      router.push("/admin/formularios");
    } catch (caught) {
      setError(
        describeError(
          caught,
          action === "delete"
            ? "Não foi possível excluir o formulário."
            : "Não foi possível despublicar o formulário.",
        ),
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <FormManagementSection
      title="Despublicar ou excluir"
      description="Disponível quando a coleta está suspensa para todas as organizações que ainda estão em preenchimento ou correção."
    >
      <div className={`${formManagementUi.surface} space-y-4 p-4`}>
        {canWithdraw ? (
          <label className={`${formSurface.fieldGroup} block max-w-2xl`}>
            <span className={formSurface.label}>Justificativa *</span>
            <textarea
              className={formSurface.inputTextarea}
              rows={3}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              placeholder="Descreva o motivo administrativo da operação."
            />
          </label>
        ) : (
          <p className={formSurface.messageWarning}>
            Suspenda a coleta antes de despublicar ou excluir.{" "}
            <Link href={manageHref} className="font-medium underline">
              Abrir a gestão do formulário
            </Link>
          </p>
        )}

        {error ? (
          <p role="alert" className={formSurface.messageError}>
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <LoadingButton
            type="button"
            pending={pending === "unpublish"}
            disabled={!canWithdraw || pending !== null}
            onClick={() => void run("unpublish")}
            className={formSurface.secondaryButton}
          >
            Despublicar
          </LoadingButton>
          <LoadingButton
            type="button"
            pending={pending === "delete"}
            disabled={!canWithdraw || pending !== null}
            onClick={() => void run("delete")}
            className={formSurface.dangerButton}
          >
            Excluir
          </LoadingButton>
        </div>
      </div>
    </FormManagementSection>
  );
}
