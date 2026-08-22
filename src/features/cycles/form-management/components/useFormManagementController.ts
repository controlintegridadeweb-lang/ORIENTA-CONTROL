"use client";

import { useCallback, useEffect, useMemo } from "react";
import { usePatchState } from "@/shared/hooks/use-patch-state";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/shared/ui/components/confirm-dialog";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import {
  asFortalezaIso,
  toFortalezaDateTimeInput,
} from "@/shared/datetime/fortaleza-date-time";
import {
  changeFormApplicationDeadline,
  reopenFormApplication,
  reopenFormApplicationValidation,
  setFormApplicationPause,
} from "../client";
import {
  buildDeadlineChangePreview,
  FORM_ADMIN_ACTION_LABEL,
  type DeadlineScope,
  type FormAdminActionKey,
} from "../domain";
import type { FormManagementDetails } from "../types";

export type ActiveFormManagementAction = Exclude<
  FormAdminActionKey,
  "view_history"
> | null;

export function formatManagementDeadline(value: string | null | undefined) {
  if (!value) return "—";
  return formatPlatformDateTime(value, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function targetOrganizationIds(
  scope: DeadlineScope,
  organizationIds: string[],
): string[] | undefined {
  return scope === "all" || scope === "overdue" ? undefined : organizationIds;
}

export function useFormManagementController(initialDetails: FormManagementDetails) {
  const router = useRouter();
  const confirm = useConfirm();
  const [state, patchState] = usePatchState({
    details: initialDetails,
    activeAction: null as ActiveFormManagementAction,
    scope: "all" as DeadlineScope,
    organizationIds: [] as string[],
    deadlineLocal: "",
    justification: "",
    reopenMode: "full" as "full" | "partial",
    questionVersionIds: [] as string[],
    pending: false,
    error: null as string | null,
    postValidationGuidance: null as string | null,
  });
  const {
    details,
    activeAction,
    scope,
    organizationIds,
    deadlineLocal,
    justification,
    reopenMode,
    questionVersionIds,
    pending,
    error,
    postValidationGuidance,
  } = state;

  const setScope = useCallback((value: DeadlineScope) => patchState({ scope: value }), [patchState]);
  const setOrganizationIds = useCallback((value: string[]) => patchState({ organizationIds: value }), [patchState]);
  const setDeadlineLocal = useCallback((value: string) => patchState({ deadlineLocal: value }), [patchState]);
  const setJustification = useCallback((value: string) => patchState({ justification: value }), [patchState]);
  const setReopenMode = useCallback((value: "full" | "partial") => patchState({ reopenMode: value }), [patchState]);
  const setQuestionVersionIds = useCallback((value: string[]) => patchState({ questionVersionIds: value }), [patchState]);

  useEffect(() => patchState({ details: initialDetails }), [initialDetails, patchState]);

  const actionMap = useMemo(
    () => Object.fromEntries(details.actions.map((action) => [action.key, action])),
    [details.actions],
  );

  const selectedOrganizations = details.organizations.filter((organization) =>
    organizationIds.includes(organization.organizationId),
  );
  const scopedOrganizations =
    scope === "overdue"
      ? details.organizations.filter((organization) => organization.deadlineStatus === "overdue")
      : scope === "all"
        ? details.organizations.filter(
            (organization) =>
              organization.state === "in_response" ||
              organization.state === "awaiting_adjustment",
          )
        : selectedOrganizations;

  const previewText =
    activeAction &&
    !["suspend", "resume", "reopen_validation"].includes(activeAction)
      ? buildDeadlineChangePreview({
          previousDeadlines: scopedOrganizations.map((organization) =>
            formatManagementDeadline(organization.applicableDeadlineAt),
          ),
          newDeadlineAt: deadlineLocal
            ? formatManagementDeadline(asFortalezaIso(deadlineLocal))
            : "—",
          organizationCount: scopedOrganizations.length,
        })
      : null;

  function resetForm() {
    patchState({ activeAction: null });
    patchState({ scope: "all" });
    patchState({ organizationIds: [] });
    patchState({ deadlineLocal: "" });
    patchState({ justification: "" });
    patchState({ reopenMode: "full" });
    patchState({ questionVersionIds: [] });
    patchState({ error: null });
  }

  function scrollToActions() {
    document.getElementById("acoes")?.scrollIntoView({ behavior: "smooth" });
  }

  function startAction(key: FormAdminActionKey) {
    const metadata = actionMap[key];
    if (!metadata?.available && key !== "view_history") return;
    if (key === "view_history") {
      document.getElementById("historico")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    patchState({ activeAction: key });
    patchState({ scope: key === "extend_deadline" ? "overdue" : "all" });
    patchState({ organizationIds: [] });
    patchState({
      deadlineLocal: details.currentGlobalDeadlineAt
        ? toFortalezaDateTimeInput(new Date(details.currentGlobalDeadlineAt))
        : "",
    });
    patchState({ justification: "" });
    patchState({ reopenMode: "full" });
    patchState({ questionVersionIds: [] });
    patchState({ postValidationGuidance: null });
    patchState({ error: null });
  }

  function startOrganizationAction(
    action: Extract<
      ActiveFormManagementAction,
      "change_deadline" | "reopen_validation" | "reopen_responses"
    >,
    organizationId: string,
    applicableDeadlineAt: string | null,
  ) {
    patchState({ activeAction: action });
    patchState({ scope: "single" });
    patchState({ organizationIds: [organizationId] });
    patchState({ justification: "" });
    patchState({ postValidationGuidance: null });
    if (action !== "reopen_validation") {
        patchState({
        deadlineLocal: applicableDeadlineAt
          ? toFortalezaDateTimeInput(new Date(applicableDeadlineAt))
          : "",
      });
    }
    if (action === "reopen_responses") {
      patchState({ reopenMode: "full" });
      patchState({ questionVersionIds: [] });
    }
    scrollToActions();
  }

  function validateAction(): string | null {
    if (!activeAction) return "Selecione uma ação administrativa.";
    const needsDeadline = [
      "change_deadline",
      "extend_deadline",
      "reopen_responses",
    ].includes(activeAction);
    if (needsDeadline && !deadlineLocal) {
      return "Informe data e horário válidos para o novo prazo.";
    }
    if (justification.trim().length < 10) {
      return "Informe uma justificativa com pelo menos 10 caracteres.";
    }
    if (
      activeAction === "reopen_responses" &&
      reopenMode === "partial" &&
      questionVersionIds.length === 0
    ) {
      return "Selecione ao menos um critério para a reabertura parcial.";
    }
    return null;
  }

  async function executeAction() {
    if (!activeAction) return;
    const deadlineIso = deadlineLocal ? asFortalezaIso(deadlineLocal) : null;
    const organizationTarget = targetOrganizationIds(scope, organizationIds);
    const base = {
      formId: details.formId,
      periodLabel: details.periodLabel,
      scope,
      organizationIds: organizationTarget,
      justification,
    };

    if (activeAction === "suspend" || activeAction === "resume") {
      await setFormApplicationPause({
        ...base,
        pause: activeAction === "suspend",
      });
      return;
    }
    if (activeAction === "reopen_validation") {
      const result = await reopenFormApplicationValidation(base);
      patchState({
        postValidationGuidance:
          `${result.reopened ?? result.updated} órgão(s) com validação reaberta. ` +
          "Próximo passo: abra a fila de validação do órgão e solicite ajuste para liberar a complementação do respondente. " +
          "O Resultado FAMI anterior permanece no histórico; o novo só vale após concluir esta rodada.",
      });
      return;
    }
    if (activeAction === "reopen_responses") {
      await reopenFormApplication({
        ...base,
        newDeadlineAt: deadlineIso!,
        reopenMode,
        questionVersionIds:
          reopenMode === "partial" ? questionVersionIds : undefined,
      });
      return;
    }
    await changeFormApplicationDeadline({
      ...base,
      action: activeAction,
      newDeadlineAt: activeAction === "early_close" ? null : deadlineIso,
    });
  }

  async function submitActiveAction() {
    if (!activeAction) return;
    patchState({ pending: true });
    patchState({ error: null });
    try {
      const validationError = validateAction();
      if (validationError) {
        patchState({ error: validationError });
        return;
      }
      const confirmed = await confirm({
        title: FORM_ADMIN_ACTION_LABEL[activeAction],
        description:
          activeAction === "reopen_validation"
            ? "O FAMI e as decisões anteriores serão preservados no histórico. Uma nova rodada de validação será aberta. O novo FAMI só será consolidado após a conclusão dessa rodada."
            : previewText ??
              `Confirmar ${FORM_ADMIN_ACTION_LABEL[activeAction].toLowerCase()} para o formulário selecionado?`,
        confirmLabel: "Confirmar",
        cancelLabel: "Cancelar",
      });
      if (!confirmed) return;

      await executeAction();
      notify.success("Operação administrativa concluída.");
      resetForm();
      router.refresh();
    } catch (caught) {
      patchState({ error: describeError(caught, "Não foi possível concluir a operação.") });
    } finally {
      patchState({ pending: false });
    }
  }

  function toggleQuestionVersion(questionVersionId: string) {
    patchState((current) => ({
      questionVersionIds: current.questionVersionIds.includes(questionVersionId)
        ? current.questionVersionIds.filter((id) => id !== questionVersionId)
        : [...current.questionVersionIds, questionVersionId],
    }));
  }

  return {
    details,
    activeAction,
    scope,
    organizationIds,
    deadlineLocal,
    justification,
    reopenMode,
    questionVersionIds,
    pending,
    error,
    postValidationGuidance,
    previewText,
    setScope,
    setOrganizationIds,
    setDeadlineLocal,
    setJustification,
    setReopenMode,
    setQuestionVersionIds,
    resetForm,
    startAction,
    startOrganizationAction,
    submitActiveAction,
    toggleQuestionVersion,
  };
}

export type FormManagementController = ReturnType<typeof useFormManagementController>;
