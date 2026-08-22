import { isOfficialFamiEligible } from "@/shared/domain/workflow";
import { respondentCycleStateLabelOrFallback } from "@/shared/domain/cycle-labels";
import type { RespondentProgress } from "./contracts";

export type PresentationAction = {
  href: string;
  label: string;
};

export type PresentationProgress = {
  kind: "answers" | "corrections";
  completed: number;
  total: number;
  percent: number;
  /** Representação principal do progresso (ex.: "72 de 96 perguntas respondidas"). */
  summary: string;
};

export type RespondentFormPresentation = {
  statusLabel: string;
  statusTone: "neutral" | "success" | "warning" | "danger";
  description: string | null;
  primaryAction: PresentationAction | null;
  secondaryAction: PresentationAction | null;
  showProgress: boolean;
  progress: PresentationProgress | null;
};

type PresentationOptions = {
  contextYear?: number;
};

function cycleReturnQuery(contextYear?: number): string {
  return contextYear
    ? `?returnTo=${encodeURIComponent(`/respondente/formularios?year=${contextYear}`)}`
    : "";
}

export function cycleResponsesHref(cycleId: string, contextYear?: number): string {
  return `/respondente/ciclos/${encodeURIComponent(cycleId)}${cycleReturnQuery(contextYear)}`;
}

export function cycleFamiResultHref(cycleId: string): string {
  return `/respondente/pontuacao-fami?cycleId=${encodeURIComponent(cycleId)}`;
}

function progressPercent(completed: number, total: number, submissionReady: boolean): number {
  if (total > 0) return Math.round((completed / total) * 100);
  return submissionReady ? 100 : 0;
}

function answersProgress(form: RespondentProgress): PresentationProgress | null {
  if (form.totalQuestions === 0) {
    return {
      kind: "answers",
      completed: 0,
      total: 0,
      percent: form.submissionReady ? 100 : 0,
      summary: "Nenhuma pergunta aplicável",
    };
  }

  const percent = progressPercent(
    form.answeredQuestions,
    form.totalQuestions,
    form.submissionReady,
  );

  return {
    kind: "answers",
    completed: form.answeredQuestions,
    total: form.totalQuestions,
    percent,
    summary: `${form.answeredQuestions} de ${form.totalQuestions} perguntas respondidas`,
  };
}

function correctionsProgress(form: RespondentProgress): PresentationProgress | null {
  const total = form.complementationRequests;
  const completed = form.resolvedComplementationRequests;
  if (total <= 0) return null;

  const percent = progressPercent(completed, total, form.submissionReady);
  return {
    kind: "corrections",
    completed,
    total,
    percent,
    summary: `${completed} de ${total} ${total === 1 ? "correção resolvida" : "correções resolvidas"}`,
  };
}

function pendingCorrectionsCount(form: RespondentProgress): number {
  return Math.max(0, form.complementationRequests - form.resolvedComplementationRequests);
}

function resolveStatus(form: RespondentProgress): Pick<
  RespondentFormPresentation,
  "statusLabel" | "statusTone"
> {
  if (form.state === "in_response" && form.submissionReady) {
    return { statusLabel: "Pronto para envio", statusTone: "success" };
  }
  if (form.state === "awaiting_adjustment" && form.submissionReady) {
    return { statusLabel: "Pronto para reenvio", statusTone: "success" };
  }
  if (form.state === "awaiting_adjustment") {
    return {
      statusLabel: respondentCycleStateLabelOrFallback(form.state),
      statusTone: "warning",
    };
  }
  if (isOfficialFamiEligible(form.state)) {
    return {
      statusLabel: form.state === "completed" ? "Encerrado" : "Concluído",
      statusTone: "success",
    };
  }
  return {
    statusLabel: respondentCycleStateLabelOrFallback(form.state),
    statusTone: "neutral",
  };
}

function resolveDescription(form: RespondentProgress): string | null {
  switch (form.state) {
    case "in_response": {
      if (form.submissionReady) {
        return "Todas as perguntas foram respondidas. Revise e envie o diagnóstico.";
      }
      if (form.totalQuestions === 0) {
        return "Não há perguntas aplicáveis neste diagnóstico.";
      }
      if (form.answeredQuestions === 0) {
        return "Este diagnóstico ainda não foi iniciado.";
      }
      if (form.submissionBlockCount > 0) {
        const count = form.submissionBlockCount;
        return `${count} ${count === 1 ? "item pendente" : "itens pendentes"} antes do envio.`;
      }
      return "Continue o preenchimento do diagnóstico.";
    }
    case "awaiting_adjustment": {
      if (form.submissionReady) {
        return "As correções foram resolvidas. Revise e reenvie o diagnóstico.";
      }
      const pending = pendingCorrectionsCount(form);
      if (pending > 0) {
        return `${pending} ${pending === 1 ? "correção pendente" : "correções pendentes"} antes do reenvio.`;
      }
      return "Há correções solicitadas pela administração.";
    }
    case "submitted":
      return "Seu diagnóstico foi enviado e aguarda o início da validação.";
    case "in_validation":
      return "A administração está validando suas respostas. Neste momento, o conteúdo permanece disponível para consulta.";
    case "validated":
      return "Seu diagnóstico foi concluído. O resultado FAMI está disponível.";
    case "completed":
      return "A avaliação foi encerrada. O resultado FAMI permanece disponível.";
    default:
      return null;
  }
}

function resolveActions(
  form: RespondentProgress,
  contextYear?: number,
): Pick<RespondentFormPresentation, "primaryAction" | "secondaryAction"> {
  const responsesHref = cycleResponsesHref(form.cycleId, contextYear);

  switch (form.state) {
    case "in_response": {
      if (form.submissionReady) {
        return {
          primaryAction: { href: responsesHref, label: "Revisar e enviar" },
          secondaryAction: null,
        };
      }
      return {
        primaryAction: {
          href: responsesHref,
          label: form.answeredQuestions === 0 ? "Iniciar diagnóstico" : "Continuar diagnóstico",
        },
        secondaryAction: null,
      };
    }
    case "awaiting_adjustment":
      return {
        primaryAction: {
          href: responsesHref,
          label: form.submissionReady ? "Revisar e reenviar" : "Corrigir pendências",
        },
        secondaryAction: null,
      };
    case "submitted":
    case "in_validation":
      return {
        primaryAction: { href: responsesHref, label: "Ver respostas" },
        secondaryAction: null,
      };
    case "validated":
    case "completed":
      return {
        primaryAction: {
          href: cycleFamiResultHref(form.cycleId),
          label: "Ver Resultado FAMI",
        },
        secondaryAction:
          form.answeredQuestions > 0
            ? { href: responsesHref, label: "Ver respostas" }
            : null,
      };
    default:
      return {
        primaryAction: { href: responsesHref, label: "Acompanhar diagnóstico" },
        secondaryAction: null,
      };
  }
}

function resolveProgress(
  form: RespondentProgress,
): Pick<RespondentFormPresentation, "showProgress" | "progress"> {
  if (form.state === "awaiting_adjustment") {
    if (form.submissionReady) {
      return { showProgress: false, progress: null };
    }
    const progress = correctionsProgress(form);
    return { showProgress: progress !== null, progress };
  }

  if (form.state === "in_response") {
    if (form.submissionReady) {
      return { showProgress: false, progress: null };
    }
    const progress = answersProgress(form);
    return { showProgress: progress !== null, progress };
  }

  return { showProgress: false, progress: null };
}

/**
 * Única fonte de verdade de apresentação do card de diagnóstico do respondente.
 * Deriva rótulos, orientação, CTAs e progresso a partir do estado de domínio —
 * sem recriar regras de negócio na UI.
 */
export function getRespondentFormPresentation(
  form: RespondentProgress,
  options: PresentationOptions = {},
): RespondentFormPresentation {
  const status = resolveStatus(form);
  const actions = resolveActions(form, options.contextYear);
  const progress = resolveProgress(form);

  return {
    ...status,
    description: resolveDescription(form),
    ...actions,
    ...progress,
  };
}
