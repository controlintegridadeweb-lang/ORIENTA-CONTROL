"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { useConfirm } from "@/shared/ui/components/confirm-dialog";
import type { QuestionRow } from "@/features/forms/admin-service";
import {
  createFormQuestion,
  removeFormQuestion,
  reorderFormQuestions,
  updateFormQuestion,
} from "@/features/forms/client";
import type { NewFormQuestion } from "./form-question-create-form";

export function useFormQuestionMutations({
  formId,
  questions,
  setQuestions,
  setExpandedId,
  setError,
  setPage,
  totalPages,
  forgetConfiguration,
}: {
  formId: string;
  questions: QuestionRow[] | null;
  setQuestions: Dispatch<SetStateAction<QuestionRow[] | null>>;
  setExpandedId: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setPage: (page: number) => void;
  totalPages: number;
  forgetConfiguration: (questionId: string) => void;
}) {
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  async function handleCreate(input: NewFormQuestion): Promise<boolean> {
    setError(null);
    try {
      const question = await createFormQuestion(formId, input);
      setQuestions((current) => [...(current ?? []), question]);
      setExpandedId(question.id);
      setPage(totalPages + 1);
      return true;
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "Falha ao criar pergunta.",
      );
      return false;
    }
  }

  async function updateBooleanField(
    question: QuestionRow,
    field: "requiresEvidence" | "allowsNotApplicable",
    checked: boolean,
  ) {
    if (checked === question[field]) return;
    setBusyId(question.id);
    setError(null);
    try {
      const payload =
        field === "requiresEvidence"
          ? { requiresEvidence: checked }
          : { allowsNotApplicable: checked };
      const updated = await updateFormQuestion(formId, question.id, payload);
      setQuestions((current) =>
        (current ?? []).map((item) =>
          item.id === question.id ? updated : item,
        ),
      );
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Falha ao atualizar.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSavePrompt(question: QuestionRow) {
    const nextPrompt = draft.trim();
    if (!nextPrompt) {
      setError("O enunciado não pode ficar vazio.");
      return;
    }
    if (nextPrompt === question.prompt) {
      setEditingId(null);
      return;
    }
    setBusyId(question.id);
    setError(null);
    try {
      const updated = await updateFormQuestion(formId, question.id, {
        prompt: nextPrompt,
      });
      setQuestions((current) =>
        (current ?? []).map((item) =>
          item.id === question.id ? updated : item,
        ),
      );
      setEditingId(null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Falha ao atualizar.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(question: QuestionRow) {
    const confirmed = await confirm({
      title: "Remover pergunta?",
      description: `"${question.prompt.slice(0, 60)}${question.prompt.length > 60 ? "..." : ""}" será removida deste formulário.`,
      confirmLabel: "Remover",
      tone: "danger",
    });
    if (!confirmed) return;
    setBusyId(question.id);
    setError(null);
    try {
      await removeFormQuestion(formId, question.id);
      setQuestions((current) =>
        (current ?? []).filter((item) => item.id !== question.id),
      );
      forgetConfiguration(question.id);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Falha ao remover.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleMove(
    question: QuestionRow,
    direction: "up" | "down",
  ) {
    const currentQuestions = questions ?? [];
    const currentIndex = currentQuestions.findIndex(
      (item) => item.id === question.id,
    );
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (
      currentIndex === -1 ||
      targetIndex < 0 ||
      targetIndex >= currentQuestions.length
    ) {
      return;
    }

    const nextOrder = [...currentQuestions];
    const [movedQuestion] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(targetIndex, 0, movedQuestion);
    setQuestions(nextOrder);
    setBusyId(question.id);
    setError(null);
    try {
      const persisted = await reorderFormQuestions(
        formId,
        nextOrder.map((item) => item.id),
      );
      setQuestions(persisted);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Falha ao reordenar.");
      setQuestions(currentQuestions);
    } finally {
      setBusyId(null);
    }
  }

  function startEditing(question: QuestionRow) {
    setDraft(question.prompt);
    setEditingId(question.id);
  }

  return {
    busyId,
    editingId,
    draft,
    setDraft,
    cancelEditing: () => setEditingId(null),
    startEditing,
    handleCreate,
    handleToggleEvidence: (question: QuestionRow, checked: boolean) =>
      updateBooleanField(question, "requiresEvidence", checked),
    handleToggleAllowsNotApplicable: (
      question: QuestionRow,
      checked: boolean,
    ) => updateBooleanField(question, "allowsNotApplicable", checked),
    handleSavePrompt,
    handleRemove,
    handleMove,
  };
}
