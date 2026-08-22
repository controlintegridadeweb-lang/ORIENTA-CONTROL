"use client";

import { useState, type FormEvent } from "react";
import { Spinner } from "@/shared/ui/components/loading";
import { formSurface } from "@/shared/layout/form-surface";
import type { LibraryAxis, LibrarySection } from "@/features/library";
import { FormAllowsNotApplicableField } from "./form-allows-not-applicable-field";
import { FormEvidenceRequirementField } from "./form-evidence-requirement-field";
import { sectionLabel } from "./form-questions-configurator-helpers";

export type NewFormQuestion = {
  prompt: string;
  sectionId: string;
  requiresEvidence: boolean;
  allowsNotApplicable: boolean;
};

type Props = {
  catalog: {
    axes: LibraryAxis[];
    sections: LibrarySection[];
  } | null;
  onCreate: (question: NewFormQuestion) => Promise<boolean>;
  onValidationError: (message: string) => void;
};

/** Formulário autocontido para cadastrar uma nova pergunta. */
export function FormQuestionCreateForm({
  catalog,
  onCreate,
  onValidationError,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [requiresEvidence, setRequiresEvidence] = useState(false);
  const [allowsNotApplicable, setAllowsNotApplicable] = useState(false);
  const [creating, setCreating] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim()) {
      onValidationError("Informe o enunciado da pergunta.");
      return;
    }
    if (!sectionId) {
      onValidationError("Selecione a seção da biblioteca.");
      return;
    }

    setCreating(true);
    try {
      const created = await onCreate({
        prompt: prompt.trim(),
        sectionId,
        requiresEvidence,
        allowsNotApplicable,
      });
      if (!created) return;

      // A seção é preservada para agilizar cadastros consecutivos no mesmo contexto.
      setPrompt("");
      setRequiresEvidence(false);
      setAllowsNotApplicable(false);
    } finally {
      setCreating(false);
    }
  }

  const hasSections = Boolean(catalog?.sections.length);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className={formSurface.fieldGroup}>
        <label htmlFor="new-question-section" className="text-sm font-semibold text-slate-800">
          Seção da biblioteca
        </label>
        <select
          id="new-question-section"
          value={sectionId}
          onChange={(event) => setSectionId(event.target.value)}
          className={formSurface.input}
          disabled={!hasSections}
          required
        >
          <option value="">
            {!catalog
              ? "Carregando seções…"
              : catalog.sections.length === 0
                ? "Nenhuma seção disponível"
                : "Selecione a seção…"}
          </option>
          {(catalog?.sections ?? []).map((section) => (
            <option key={section.id} value={section.id}>
              {sectionLabel(section, catalog?.axes ?? [])}
            </option>
          ))}
        </select>
        <p className={formSurface.fieldHint}>
          A seção define o eixo ESG e é obrigatória para a publicação do formulário.
        </p>
      </div>

      <div className={formSurface.fieldGroup}>
        <label htmlFor="new-question-prompt" className="text-sm font-semibold text-slate-800">
          Nova pergunta
        </label>
        <p className={formSurface.fieldHint}>
          Texto exibido ao respondente. Você pode reordenar e editar depois.
        </p>
        <textarea
          id="new-question-prompt"
          placeholder="Digite o enunciado da pergunta"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={3}
          maxLength={500}
          className={`${formSurface.inputTextarea} min-h-19`}
        />
      </div>

      <FormEvidenceRequirementField
        id="new-question-evidence"
        checked={requiresEvidence}
        disabled={!hasSections}
        onChange={setRequiresEvidence}
      />

      <FormAllowsNotApplicableField
        id="new-question-allows-na"
        checked={allowsNotApplicable}
        disabled={!hasSections}
        onChange={setAllowsNotApplicable}
      />

      <div className="flex justify-start">
        <button
          type="submit"
          disabled={creating || !prompt.trim() || !sectionId || !hasSections}
          className={formSurface.primaryButton}
        >
          {creating ? (
            <>
              <Spinner size="md" />
              Adicionando…
            </>
          ) : (
            "Adicionar pergunta"
          )}
        </button>
      </div>
    </form>
  );
}
