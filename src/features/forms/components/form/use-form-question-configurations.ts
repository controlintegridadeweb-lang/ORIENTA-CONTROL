"use client";

import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  createDefaultConfiguration,
  defaultMetricForPrompt,
  RECOMMENDATION_TITLE_MAX,
} from "@/features/forms/components/form/form-questions-configurator-helpers";
import {
  fetchQuestionConfiguration,
  saveQuestionConfiguration,
} from "@/features/library";
import type {
  LibraryBindings,
  QuestionLibraryConfiguration,
} from "@/features/library";
import type { QuestionRow } from "@/features/forms/admin-service";

type Params = {
  formId: string;
  questions: QuestionRow[] | null;
  expandedQuestionId: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
};

/** Gerencia exclusivamente o vínculo de cada pergunta com a biblioteca. */
export function useFormQuestionConfigurations({
  formId,
  questions,
  expandedQuestionId,
  setError,
}: Params) {
  const [configByQuestion, setConfigByQuestion] = useState<
    Record<string, QuestionLibraryConfiguration>
  >({});
  const [loadedConfigIds, setLoadedConfigIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [loadingConfigId, setLoadingConfigId] = useState<string | null>(null);
  const [savingConfigId, setSavingConfigId] = useState<string | null>(null);
  const [failedConfigIds, setFailedConfigIds] = useState<Set<string>>(
    () => new Set(),
  );

  const loadConfiguration = useCallback(
    async (question: QuestionRow) => {
      setLoadingConfigId(question.id);
      setError(null);
      try {
        const fromApi = await fetchQuestionConfiguration(formId, question.id);
        const configuration =
          fromApi ??
          createDefaultConfiguration(
            question.id,
            question.prompt,
            question.sectionId ?? "",
          );
        const normalizedConfiguration = configuration.metric?.answerType
          ? configuration
          : {
              ...configuration,
              metric: defaultMetricForPrompt(question.prompt),
            };

        setConfigByQuestion((current) => ({
          ...current,
          [question.id]: normalizedConfiguration,
        }));
        setLoadedConfigIds((current) => new Set(current).add(question.id));
        setFailedConfigIds((current) => {
          if (!current.has(question.id)) return current;
          const next = new Set(current);
          next.delete(question.id);
          return next;
        });
      } catch (error: unknown) {
        setError(
          error instanceof Error
            ? error.message
            : "Falha ao carregar configuração.",
        );
        setConfigByQuestion((current) => {
          if (!current[question.id]) return current;
          const next = { ...current };
          delete next[question.id];
          return next;
        });
        setLoadedConfigIds((current) => {
          if (!current.has(question.id)) return current;
          const next = new Set(current);
          next.delete(question.id);
          return next;
        });
        setFailedConfigIds((current) => new Set(current).add(question.id));
      } finally {
        setLoadingConfigId(null);
      }
    },
    [formId, setError],
  );

  useEffect(() => {
    if (!expandedQuestionId || loadedConfigIds.has(expandedQuestionId)) return;
    const question = questions?.find((item) => item.id === expandedQuestionId);
    if (!question) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Carrega sob demanda a configuração da pergunta expandida.
    void loadConfiguration(question);
  }, [expandedQuestionId, loadConfiguration, loadedConfigIds, questions]);

  async function saveConfiguration(questionId: string) {
    const current = configByQuestion[questionId];
    if (!current) return;

    setSavingConfigId(questionId);
    setError(null);
    try {
      const bindings: LibraryBindings = {
        defaultRecommendation: current.bindings.defaultRecommendation ?? null,
        note: current.bindings.note ?? null,
      };
      const saved = await saveQuestionConfiguration(formId, questionId, {
        sectionId: current.sectionId,
        metric: { answerType: "yes_no" },
        bindings,
        responseMapping: {},
      });
      setConfigByQuestion((previous) => ({
        ...previous,
        [questionId]: saved,
      }));
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Falha ao salvar configuração.",
      );
    } finally {
      setSavingConfigId(null);
    }
  }

  function forgetConfiguration(questionId: string) {
    setConfigByQuestion((current) => {
      if (!current[questionId]) return current;
      const next = { ...current };
      delete next[questionId];
      return next;
    });
    setLoadedConfigIds((current) => {
      if (!current.has(questionId)) return current;
      const next = new Set(current);
      next.delete(questionId);
      return next;
    });
    setLoadingConfigId((current) => (current === questionId ? null : current));
    setSavingConfigId((current) => (current === questionId ? null : current));
    setFailedConfigIds((current) => {
      if (!current.has(questionId)) return current;
      const next = new Set(current);
      next.delete(questionId);
      return next;
    });
  }

  function changeSection(
    questionId: string,
    sectionId: string,
    fallback: QuestionLibraryConfiguration,
  ) {
    setConfigByQuestion((current) => {
      const base = current[questionId] ?? fallback;
      return {
        ...current,
        [questionId]: { ...base, sectionId },
      };
    });
  }

  function changeRecommendation(
    questionId: string,
    prompt: string,
    fallback: QuestionLibraryConfiguration,
    recommendationText: string,
  ) {
    setConfigByQuestion((current) => {
      const base = current[questionId] ?? fallback;
      const currentRecommendation = base.bindings.defaultRecommendation;
      const defaultRecommendation = recommendationText.trim()
        ? {
            ...(currentRecommendation ?? {}),
            title: currentRecommendation?.title?.trim()
              ? currentRecommendation.title
              : `Recomendação para: ${prompt}`.slice(
                  0,
                  RECOMMENDATION_TITLE_MAX,
                ),
            textoBaseFixo: recommendationText,
            tipo: currentRecommendation?.tipo ?? "nao_implementacao",
          }
        : null;

      return {
        ...current,
        [questionId]: {
          ...base,
          bindings: {
            ...base.bindings,
            defaultRecommendation,
          },
        },
      };
    });
  }

  return {
    configByQuestion,
    loadedConfigIds,
    failedConfigIds,
    loadingConfigId,
    savingConfigId,
    retryConfiguration: loadConfiguration,
    saveConfiguration,
    forgetConfiguration,
    changeSection,
    changeRecommendation,
  };
}
