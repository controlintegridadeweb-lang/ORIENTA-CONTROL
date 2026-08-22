"use client";

import { useState } from "react";
import type { QuestionRow } from "@/features/forms/admin-service";
import {
  replaceQuestionWaivers,
  type QuestionWaiverRow,
} from "@/features/forms/waiver-client";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import type { WaiversByQuestion } from "./form-questions-configurator-helpers";
import type { OrgOption } from "./waiver-editor-modal";
import {
  buildDesiredQuestionWaivers,
  deriveWaiverReasonState,
  waiverReplacementChanged,
} from "./question-waiver-editor-model";

type EditorState = {
  questionId: string;
  prompt: string;
  selectedOrgIds: Set<string>;
  reason: string;
  reasonTouched: boolean;
  hasMixedReasons: boolean;
};

type Params = {
  organizations: OrgOption[];
  waiversByQuestion: WaiversByQuestion;
  reloadWaivers: (organizations: OrgOption[]) => Promise<void>;
};

/** Gerencia o modal e a persistência atômica das dispensas por organização. */
export function useQuestionWaiverEditor({
  organizations,
  waiversByQuestion,
  reloadWaivers,
}: Params) {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [organizationFilter, setOrganizationFilter] = useState("");
  const [saving, setSaving] = useState(false);

  function open(question: QuestionRow) {
    const current =
      waiversByQuestion.get(question.id) ??
      new Map<string, QuestionWaiverRow>();
    const reasonState = deriveWaiverReasonState(current);

    setOrganizationFilter("");
    setEditor({
      questionId: question.id,
      prompt: question.prompt,
      selectedOrgIds: new Set(current.keys()),
      reason: reasonState.displayedReason,
      reasonTouched: false,
      hasMixedReasons: reasonState.hasMixedReasons,
    });
  }

  function close() {
    if (saving) return;
    setEditor(null);
    setOrganizationFilter("");
  }

  function toggleOrganization(organizationId: string) {
    setEditor((current) => {
      if (!current) return current;
      const selectedOrgIds = new Set(current.selectedOrgIds);
      if (selectedOrgIds.has(organizationId)) {
        selectedOrgIds.delete(organizationId);
      } else {
        selectedOrgIds.add(organizationId);
      }
      return { ...current, selectedOrgIds };
    });
  }

  function selectOrganizations(organizationIds: string[]) {
    setEditor((current) =>
      current
        ? {
            ...current,
            selectedOrgIds: new Set([
              ...current.selectedOrgIds,
              ...organizationIds,
            ]),
          }
        : current,
    );
  }

  function clearOrganizations() {
    setEditor((current) =>
      current ? { ...current, selectedOrgIds: new Set() } : current,
    );
  }

  function changeReason(reason: string) {
    setEditor((current) =>
      current
        ? {
            ...current,
            reason,
            reasonTouched: true,
          }
        : current,
    );
  }

  async function save() {
    if (!editor) return;

    const current =
      waiversByQuestion.get(editor.questionId) ??
      new Map<string, QuestionWaiverRow>();
    const desiredWaivers = buildDesiredQuestionWaivers({
      current,
      selectedOrganizationIds: editor.selectedOrgIds,
      displayedReason: editor.reason,
      reasonTouched: editor.reasonTouched,
    });

    if (!waiverReplacementChanged(current, desiredWaivers)) {
      close();
      return;
    }

    setSaving(true);
    try {
      await replaceQuestionWaivers({
        questionId: editor.questionId,
        scopeOrganizationIds: organizations.map((organization) => organization.id),
        waivers: desiredWaivers,
      });
      await reloadWaivers(organizations);
      notify.success("Aplicabilidade atualizada.");
      setEditor(null);
      setOrganizationFilter("");
    } catch (error: unknown) {
      notify.error(
        describeError(
          error,
          "Falha ao atualizar a aplicabilidade. Nenhuma alteração foi aplicada.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return {
    editor,
    organizationFilter,
    saving,
    setOrganizationFilter,
    open,
    close,
    toggleOrganization,
    selectOrganizations,
    clearOrganizations,
    changeReason,
    save,
  };
}
