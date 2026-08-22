"use client";

import { LoadingButton } from "@/shared/ui/components/loading";
import { formSurface } from "@/shared/layout/form-surface";
import { BatchReport } from "./create-cycle-form-fields";
import type { CreateCycleFormProps } from "./create-cycle-form-model";
import { CreateCycleIdentificationSection } from "./create-cycle-identification-section";
import { CreateCycleOrganizationsSection } from "./create-cycle-organizations-section";
import {
  CreateCycleAutomationSection,
  CreateCycleLaunchSection,
} from "./create-cycle-schedule-sections";
import { useCreateCycleForm } from "./use-create-cycle-form";

function submitLabel(
  launchMode: "draft" | "open" | "schedule",
  selectedCount: number,
): string {
  const plural = selectedCount === 1 ? "" : "s";
  if (launchMode === "open") return `Criar e abrir ${selectedCount} diagnóstico${plural}`;
  if (launchMode === "schedule") return `Criar e agendar ${selectedCount} diagnóstico${plural}`;
  return `Criar ${selectedCount} rascunho${plural}`;
}

export function CreateCycleForm({
  forms,
  organizations,
  initialFormId,
  publishedNow = false,
}: CreateCycleFormProps) {
  const controller = useCreateCycleForm({ forms, organizations, initialFormId });
  const {
    draft,
    error,
    batchReport,
    pending,
    submitDisabled,
    selectedCount,
    orgLabelById,
    handleSubmit,
  } = controller;

  return (
    <form onSubmit={handleSubmit} className={`space-y-5 ${formSurface.nestedCard}`} noValidate>
      {publishedNow ? (
        <p
          role="status"
          aria-label="Formulário publicado"
          aria-live="polite"
          className={formSurface.messageSuccess}
        >
          Formulário publicado. Defina o período, os participantes e a abertura dos diagnósticos.
        </p>
      ) : null}
      {error ? (
        <p role="alert" aria-live="assertive" className={formSurface.messageError}>
          {error}
        </p>
      ) : null}
      {batchReport ? (
        <BatchReport
          report={batchReport}
          orgLabel={(id) => orgLabelById.get(id) ?? id}
          formId={draft.formId}
          periodLabel={draft.periodLabel.trim()}
        />
      ) : null}

      <CreateCycleIdentificationSection forms={forms} controller={controller} />
      <CreateCycleOrganizationsSection controller={controller} />
      <CreateCycleLaunchSection controller={controller} />
      <CreateCycleAutomationSection controller={controller} />

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <LoadingButton
          type="submit"
          pending={pending}
          pendingLabel="Processando diagnósticos…"
          className={formSurface.primaryButton}
          disabled={submitDisabled}
        >
          {submitLabel(draft.launchMode, selectedCount)}
        </LoadingButton>
      </div>
    </form>
  );
}
