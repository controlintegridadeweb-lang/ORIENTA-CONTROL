"use client";

import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { fetchLibraryCatalog, type LibraryAxis, type LibrarySection } from "@/features/library";
import { loadRecommendationFilters } from "@/features/improvement-management";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import type { QuestionRow } from "@/features/forms/admin-service";
import { listFormQuestions } from "@/features/forms/client";
import { listQuestionWaiversForOrganizations } from "@/features/forms/waiver-client";
import {
  buildWaiversIndex,
  type WaiversByQuestion,
} from "./form-questions-configurator-helpers";
import type { OrgOption } from "./waiver-editor-modal";

export type FormQuestionsData = {
  questions: QuestionRow[] | null;
  setQuestions: Dispatch<SetStateAction<QuestionRow[] | null>>;
  catalog: { axes: LibraryAxis[]; sections: LibrarySection[] } | null;
  organizations: OrgOption[];
  waiversByQuestion: WaiversByQuestion;
  orgsLoading: boolean;
  expandedId: string | null;
  setExpandedId: Dispatch<SetStateAction<string | null>>;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  reloadWaivers: (organizations: OrgOption[]) => Promise<void>;
};

export function useFormQuestionsData({
  formId,
  onQuestionsChange,
}: {
  formId: string;
  onQuestionsChange?: (questions: QuestionRow[]) => void;
}): FormQuestionsData {
  const [questions, setQuestions] = useState<QuestionRow[] | null>(null);
  const [catalog, setCatalog] = useState<{
    axes: LibraryAxis[];
    sections: LibrarySection[];
  } | null>(null);
  const [organizations, setOrganizations] = useState<OrgOption[]>([]);
  const [waiversByQuestion, setWaiversByQuestion] = useState<WaiversByQuestion>(
    new Map(),
  );
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reloadWaivers = useCallback(async (options: OrgOption[]) => {
    if (options.length === 0) {
      setWaiversByQuestion(new Map());
      return;
    }
    const waivers = await listQuestionWaiversForOrganizations(
      options.map((organization) => organization.id),
    );
    setWaiversByQuestion(buildWaiversIndex(waivers));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchLibraryCatalog()
      .then((snapshot) => {
        if (!cancelled) {
          setCatalog({
            axes: snapshot.axes,
            sections: snapshot.sections,
          });
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(describeError(caught, "Falha ao carregar a biblioteca."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listFormQuestions(formId)
      .then((data) => {
        if (!cancelled) setQuestions(data);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(describeError(caught, "Falha ao carregar perguntas."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [formId]);

  useEffect(() => {
    if (questions !== null) onQuestionsChange?.(questions);
  }, [onQuestionsChange, questions]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reflete o início da leitura remota quando o formulário muda.
    setOrgsLoading(true);
    void loadRecommendationFilters()
      .then(async (filters) => {
        if (cancelled) return;
        setOrganizations(filters.organizations);
        await reloadWaivers(filters.organizations);
      })
      .catch((caught: unknown) => {
        if (!cancelled) notify.error(describeError(caught));
      })
      .finally(() => {
        if (!cancelled) setOrgsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadWaivers]);

  useEffect(() => {
    if (questions === null) return;
    const questionIds = new Set(questions.map((question) => question.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Mantém a expansão válida após carregar ou remover perguntas.
    setExpandedId((current) =>
      current && questionIds.has(current)
        ? current
        : (questions[0]?.id ?? null),
    );
  }, [questions]);

  return {
    questions,
    setQuestions,
    catalog,
    organizations,
    waiversByQuestion,
    orgsLoading,
    expandedId,
    setExpandedId,
    error,
    setError,
    reloadWaivers,
  };
}
