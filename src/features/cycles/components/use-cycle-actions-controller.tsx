"use client";

import { useCallback, useMemo, useReducer } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CycleListItem } from "@/features/cycles/cycle-queries";
import type { CycleState } from "@/shared/domain/types";
import {
  INTERMEDIATE_TRANSITION_LABELS,
  allowedTransitions,
  TRANSITION_EFFECT,
  type CycleTransitionEffect,
} from "@/shared/domain/workflow";
import { getValidationReopenImpact, transitionAdminCycle, updateAdminCycleSchedule, type ValidationReopenImpact } from "@/features/cycles/client";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import { useConfirm } from "@/shared/ui/components/confirm-dialog";
import { asFortalezaIso, toFortalezaDateTimeInput } from "@/shared/datetime/fortaleza-date-time";

const EFFECT_LABEL: Record<string, string> = {
  open: "Abrir diagnóstico",
  close: "Encerrar avaliação",
  reopen: "Reabrir diagnóstico",
  reopen_validation: "Reabrir validação",
};

const TRANSITION_SUCCESS: Partial<Record<CycleTransitionEffect, string>> = {
  open: "Diagnóstico aberto para respostas.",
  close: "Avaliação encerrada com sucesso.",
  reopen: "Diagnóstico reaberto com sucesso.",
  reopen_validation:
    "Validação reaberta. Revise as evidências e as respostas “Não se aplica”. " +
    "Um novo Resultado FAMI será gerado após a conclusão desta rodada.",
};

type CycleActionsState = {
  savingSchedule: boolean;
  transitioningTo: CycleState | null;
  error: string | null;
  startsAt: string;
  deadlineAt: string;
  validationDeadlineAt: string;
  cycleCloseAt: string;
  reopenReason: string;
  reopenDeadlineAt: string;
  reopenValidationModalOpen: boolean;
  reopenValidationModalKey: number;
  reopenValidationImpact: ValidationReopenImpact | null;
  reopenValidationImpactLoading: boolean;
};

type CycleActionsAction = { type: "patch"; patch: Partial<CycleActionsState> };

function reducer(state: CycleActionsState, action: CycleActionsAction): CycleActionsState {
  return action.type === "patch" ? { ...state, ...action.patch } : state;
}

function initialState(cycle: CycleListItem): CycleActionsState {
  return {
    savingSchedule: false,
    transitioningTo: null,
    error: null,
    startsAt: cycle.startsAt ? toFortalezaDateTimeInput(new Date(cycle.startsAt)) : "",
    deadlineAt: cycle.responseDeadlineAt
      ? toFortalezaDateTimeInput(new Date(cycle.responseDeadlineAt))
      : "",
    validationDeadlineAt: cycle.validationDeadlineAt
      ? toFortalezaDateTimeInput(new Date(cycle.validationDeadlineAt))
      : "",
    cycleCloseAt: cycle.cycleCloseAt
      ? toFortalezaDateTimeInput(new Date(cycle.cycleCloseAt))
      : "",
    reopenReason: "",
    reopenDeadlineAt: "",
    reopenValidationModalOpen: false,
    reopenValidationModalKey: 0,
    reopenValidationImpact: null,
    reopenValidationImpactLoading: false,
  };
}

export function useCycleActionsController(cycle: CycleListItem) {
  const router = useRouter();
  const confirm = useConfirm();
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(reducer, cycle, initialState);
  const patch = useCallback((values: Partial<CycleActionsState>) => {
    dispatch({ type: "patch", patch: values });
  }, []);

  const current = cycle.state as CycleState;
  const transitions = allowedTransitions(current);
  const boundaryTargets = useMemo(() => (
    (["open", "close", "reopen", "reopen_validation"] as const)
      .map((effect) => {
        const entry = Object.entries(TRANSITION_EFFECT).find(
          ([key]) => key.startsWith(`${current}->`) &&
            TRANSITION_EFFECT[key as keyof typeof TRANSITION_EFFECT] === effect,
        );
        if (!entry) return null;
        return {
          to: entry[0].split("->")[1] as CycleState,
          effect,
          label: EFFECT_LABEL[effect],
        };
      })
      .filter((target): target is {
        to: CycleState;
        effect: CycleTransitionEffect;
        label: string;
      } => target != null)
  ), [current]);
  const intermediateTargets = useMemo(() => (
    (current === "in_validation" ? [] : transitions)
      .map((to) => {
        const key = `${current}->${to}` as `${CycleState}->${CycleState}`;
        const label = INTERMEDIATE_TRANSITION_LABELS[key];
        return label ? { to, label } : null;
      })
      .filter((target): target is { to: CycleState; label: string } => target != null)
  ), [current, transitions]);

  const busy = state.savingSchedule || state.transitioningTo !== null;
  const hasPersistedSchedule = Boolean(cycle.startsAt && cycle.responseDeadlineAt);
  const reopenValidationTarget = boundaryTargets.find(
    (target) => target.effect === "reopen_validation",
  );
  const otherBoundaryTargets = boundaryTargets.filter(
    (target) => target.effect !== "reopen_validation" && target.effect !== "close",
  );
  const returnTo = searchParams.get("returnTo");
  const validationQueueHref = `/admin/ciclos/${cycle.id}/validacao${
    returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""
  }`;

  const saveSchedule = useCallback(async () => {
    patch({ savingSchedule: true, error: null });
    try {
      const startsAt = state.startsAt ? asFortalezaIso(state.startsAt) : null;
      const responseDeadlineAt = state.deadlineAt ? asFortalezaIso(state.deadlineAt) : null;
      const validationDeadlineAt = state.validationDeadlineAt
        ? asFortalezaIso(state.validationDeadlineAt)
        : null;
      const cycleCloseAt = state.cycleCloseAt ? asFortalezaIso(state.cycleCloseAt) : null;
      if (
        (state.startsAt && !startsAt) ||
        (state.deadlineAt && !responseDeadlineAt) ||
        (state.validationDeadlineAt && !validationDeadlineAt) ||
        (state.cycleCloseAt && !cycleCloseAt)
      ) {
        patch({ error: "Informe datas e horários válidos." });
        return;
      }
      await updateAdminCycleSchedule(cycle.id, {
        startsAt,
        responseDeadlineAt,
        validationDeadlineAt,
        cycleCloseAt,
      });
      notify.success("Datas do diagnóstico salvas.");
      router.refresh();
    } catch (error) {
      patch({ error: describeError(error, "Falha ao salvar datas.") });
    } finally {
      patch({ savingSchedule: false });
    }
  }, [cycle.id, patch, router, state.cycleCloseAt, state.deadlineAt, state.startsAt, state.validationDeadlineAt]);

  const runTransition = useCallback(async (
    to: CycleState,
    label: string,
    effect?: CycleTransitionEffect,
    validationReopenReason?: string,
  ) => {
    if (current === "draft" && to === "in_response" && !hasPersistedSchedule) {
      patch({ error: "Salve o início e o prazo de resposta antes de abrir o diagnóstico." });
      return;
    }

    let reopenInput: { reason: string; responseDeadlineAt: string } | undefined;
    let validationReopenInput: { reason: string } | undefined;
    if (effect === "reopen") {
      const reason = state.reopenReason.trim();
      const responseDeadlineAt = state.reopenDeadlineAt
        ? asFortalezaIso(state.reopenDeadlineAt)
        : null;
      if (reason.length < 10) {
        patch({ error: "Informe uma justificativa com pelo menos 10 caracteres." });
        return;
      }
      if (!responseDeadlineAt || new Date(responseDeadlineAt).getTime() <= Date.now()) {
        patch({ error: "Informe um novo prazo futuro para a reabertura." });
        return;
      }
      reopenInput = { reason, responseDeadlineAt };
    }
    if (effect === "reopen_validation") {
      const reason = (validationReopenReason ?? "").trim();
      if (reason.length < 10) {
        patch({ error: "Informe o motivo da reabertura com pelo menos 10 caracteres." });
        return;
      }
      validationReopenInput = { reason };
    }

    if (effect !== "reopen_validation") {
      const confirmed = await confirm({
        title: `${label}?`,
        description: effect === "reopen"
          ? "A reabertura cria uma nova versão de processamento e mantém o resultado anterior no histórico."
          : undefined,
        confirmLabel: label,
        cancelLabel: "Cancelar",
        tone: effect === "reopen" ? "danger" : "default",
      });
      if (!confirmed) return;
    }

    patch({ transitioningTo: to, error: null });
    try {
      await transitionAdminCycle(cycle.id, to, reopenInput, validationReopenInput);
      notify.success(effect
        ? TRANSITION_SUCCESS[effect] ?? `${label} concluído.`
        : `${label} concluído.`);
      patch({ reopenValidationModalOpen: effect === "reopen_validation" ? false : state.reopenValidationModalOpen });
      if (to === "in_validation") {
        router.push(validationQueueHref);
      } else {
        router.refresh();
      }
    } catch (error) {
      patch({ error: describeError(error, "Falha na transição do diagnóstico.") });
    } finally {
      patch({ transitioningTo: null });
    }
  }, [
    confirm,
    current,
    cycle.id,
    hasPersistedSchedule,
    patch,
    router,
    state.reopenDeadlineAt,
    state.reopenReason,
    state.reopenValidationModalOpen,
    validationQueueHref,
  ]);

  const openReopenValidationModal = useCallback(async () => {
    patch({
      error: null,
      reopenValidationModalKey: state.reopenValidationModalKey + 1,
      reopenValidationModalOpen: true,
      reopenValidationImpact: null,
      reopenValidationImpactLoading: true,
    });
    try {
      const impact = await getValidationReopenImpact(cycle.id);
      patch({ reopenValidationImpact: impact });
    } catch (error) {
      patch({
        error: describeError(error, "Não foi possível verificar o impacto da reabertura."),
        reopenValidationModalOpen: false,
      });
    } finally {
      patch({ reopenValidationImpactLoading: false });
    }
  }, [cycle.id, patch, state.reopenValidationModalKey]);

  const confirmReopenValidation = useCallback(async (reason: string) => {
    if (!reopenValidationTarget) return;
    await runTransition(
      reopenValidationTarget.to,
      reopenValidationTarget.label,
      "reopen_validation",
      reason,
    );
  }, [reopenValidationTarget, runTransition]);

  return {
    state,
    patch,
    current,
    boundaryTargets,
    intermediateTargets,
    reopenValidationTarget,
    otherBoundaryTargets,
    busy,
    hasPersistedSchedule,
    validationQueueHref,
    saveSchedule,
    runTransition,
    confirmReopenValidation,
    openReopenValidationModal,
  };
}

export type CycleActionsController = ReturnType<typeof useCycleActionsController>;
