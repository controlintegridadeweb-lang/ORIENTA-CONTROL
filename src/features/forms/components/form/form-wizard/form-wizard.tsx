"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { FormAssignmentsPanel } from "@/features/forms/components/form/form-assignments-panel";
import { FormQuestionsConfigurator } from "@/features/forms/components/form/form-questions-configurator";
import { FormManagementSection } from "@/features/forms/components/form/form-tab-panel";
import { LoadingButton } from "@/shared/ui/components/loading";
import {
  createForm,
  fetchFormPublishReadiness,
  getFormAssignments,
  publishForm,
  renameForm,
  FormPublishPendingError,
} from "@/features/forms/client";
import type { FormPublishReadiness } from "@/features/forms/publish-readiness";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import { formSurface } from "@/shared/layout/form-surface";
import {
  FORM_WIZARD_STEPS,
  derivePersistedWizardStep,
  parseWizardStep,
  resolveWizardStepAccess,
  wizardProgressStorageKey,
  wizardStepHref,
  type FormWizardStepId,
} from "./form-wizard-steps";
import { FormWizardShell } from "./form-wizard-shell";
import { FormWizardCycleStep } from "./form-wizard-cycle-step";
import { FormWizardReviewStep } from "./form-wizard-review-step";
import {
  adminReturnPathOrFallback,
  withAdminReturnPath,
} from "@/shared/navigation/admin-navigation-context";

type Props = {
  formId?: string;
  initialFormName?: string;
  nameEditable?: boolean;
};

const WIZARD_PROGRESS_EVENT = "orienta:wizard-progress";

function subscribeWizardProgress(listener: () => void): () => void {
  window.addEventListener(WIZARD_PROGRESS_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(WIZARD_PROGRESS_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

function readWizardProgress(formId: string | undefined): FormWizardStepId {
  if (!formId) return 1;
  return parseWizardStep(sessionStorage.getItem(wizardProgressStorageKey(formId)));
}

function writeWizardProgress(formId: string, step: FormWizardStepId): void {
  sessionStorage.setItem(wizardProgressStorageKey(formId), String(step));
  window.dispatchEvent(new Event(WIZARD_PROGRESS_EVENT));
}

function formWizardHref(formId: string, step: FormWizardStepId, returnTo: string): string {
  return withAdminReturnPath(wizardStepHref(formId, step), returnTo);
}

export function FormWizard({ formId, initialFormName = "", nameEditable = true }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isCreateFlow = !formId;
  const returnTo = adminReturnPathOrFallback(
    searchParams.get("returnTo"),
    "/admin/formularios",
  );

  const storedVisitedStep = useSyncExternalStore<FormWizardStepId>(
    subscribeWizardProgress,
    () => readWizardProgress(formId),
    () => 1,
  );
  const [persistedStep, setPersistedStep] = useState<FormWizardStepId>(formId ? 2 : 1);
  const maxVisitedStep = Math.max(storedVisitedStep, persistedStep) as FormWizardStepId;
  const requestedStep = isCreateFlow
    ? 1
    : searchParams.has("etapa")
      ? parseWizardStep(searchParams.get("etapa"))
      : maxVisitedStep;
  const { currentStep, maxReachableStep } = resolveWizardStepAccess(
    requestedStep,
    maxVisitedStep,
  );
  const [name, setName] = useState(initialFormName);
  const [formName, setFormName] = useState(initialFormName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [readiness, setReadiness] = useState<FormPublishReadiness | null>(null);

  const stepMeta = FORM_WIZARD_STEPS.find((s) => s.id === currentStep)!;

  useEffect(() => {
    if (!formId) return;
    let cancelled = false;
    Promise.all([fetchFormPublishReadiness(formId), getFormAssignments(formId)])
      .then(([readinessPayload, assignments]) => {
        if (cancelled) return;
        const derived = derivePersistedWizardStep({
          questionCount: readinessPayload.readiness.questionCount,
          bindingsComplete: readinessPayload.readiness.checks.bindingsComplete,
          assignmentCount: assignments.summary.organizationIds.length,
        });
        setPersistedStep(derived);
        if (derived > readWizardProgress(formId)) writeWizardProgress(formId, derived);
      })
      .catch(() => {
        // A etapa 2 permanece acessível; os componentes da etapa exibem o erro específico.
      });
    return () => {
      cancelled = true;
    };
  }, [formId]);

  useEffect(() => {
    if (!formId) return;
    if (!searchParams.has("etapa")) {
      router.replace(formWizardHref(formId, maxVisitedStep, returnTo));
      return;
    }
    if (requestedStep <= maxVisitedStep) return;
    router.replace(formWizardHref(formId, maxVisitedStep, returnTo));
  }, [formId, maxVisitedStep, requestedStep, returnTo, router, searchParams]);

  function goToStep(step: FormWizardStepId) {
    if (!formId || step > maxVisitedStep + 1) return;
    const next = step > maxVisitedStep ? step : maxVisitedStep;
    writeWizardProgress(formId, next as FormWizardStepId);
    router.push(formWizardHref(formId, step, returnTo));
  }

  async function ensureFormCreated(): Promise<string | null> {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Informe o nome do formulário.");
      return null;
    }
    if (formId) {
      if (trimmed !== formName) {
        setBusy(true);
        try {
          const updated = await renameForm(formId, trimmed);
          setFormName(updated.name);
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : "Falha ao salvar nome.");
          return null;
        } finally {
          setBusy(false);
        }
      }
      return formId;
    }
    setBusy(true);
    setError(null);
    try {
      const form = await createForm({ name: trimmed });
      setFormName(form.name);
      notify.success("Rascunho criado.");
      writeWizardProgress(form.id, 2);
      router.replace(formWizardHref(form.id, 2, returnTo));
      return form.id;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao criar formulário.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleNext() {
    if (currentStep === 1) {
      if (!formId) {
        await ensureFormCreated();
        return;
      }
      const id = await ensureFormCreated();
      if (!id) return;
      goToStep(2);
      return;
    }
    if (!formId) return;
    if (currentStep < 5) {
      goToStep((currentStep + 1) as FormWizardStepId);
    }
  }

  function handleBack() {
    if (!formId || currentStep <= 1) return;
    goToStep((currentStep - 1) as FormWizardStepId);
  }

  async function handleSaveDraft() {
    if (currentStep === 1) {
      const id = await ensureFormCreated();
      if (!id) return;
    } else if (nameEditable && formId && name.trim() && name.trim() !== formName) {
      try {
        const updated = await renameForm(formId, name.trim());
        setFormName(updated.name);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Falha ao salvar nome.");
        return;
      }
    }
    notify.success("Rascunho salvo. Você pode continuar o assistente de publicação depois.");
    router.push(returnTo);
  }

  async function handlePublish() {
    if (!formId) return;
    setBusy(true);
    setError(null);
    try {
      const latest = await fetchFormPublishReadiness(formId);
      setReadiness(latest.readiness);
      if (!latest.readiness.canPublish) {
        setError("Conclua as pendências do checklist antes de publicar.");
        return;
      }
      await publishForm(formId);
      notify.success("Formulário publicado. Crie e abra um diagnóstico para disponibilizá-lo à organização.");
      router.push(`/admin/ciclos/novo?formId=${encodeURIComponent(formId)}&published=1`);
    } catch (e: unknown) {
      if (e instanceof FormPublishPendingError) {
        setError("Perguntas ou configurações incompletas. Revise a etapa Perguntas e configurações.");
        goToStep(2);
        return;
      }
      notify.error(describeError(e, "Falha ao publicar formulário."));
    } finally {
      setBusy(false);
    }
  }


  const canPublish = useMemo(() => readiness?.canPublish ?? false, [readiness]);

  const stepContent = (() => {
    switch (currentStep) {
      case 1:
        return (
          <form
            className="max-w-3xl"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void handleNext();
            }}
          >
            <FormManagementSection
              title={stepMeta.label}
              description="Nome de exibição visível para respondentes e relatórios. O formulário nasce como rascunho."
            >
              <div className={formSurface.fieldGroup}>
                <label htmlFor="wizard-form-name" className="text-sm font-semibold text-slate-800">
                  Nome do formulário
                </label>
                <input
                  id="wizard-form-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Avaliação de Integridade 2026"
                  maxLength={200}
                  autoFocus
                  disabled={!nameEditable}
                  className={formSurface.input}
                />
                {!nameEditable ? (
                  <p className="text-xs text-slate-500">
                    O nome não pode ser alterado depois da primeira publicação, para preservar o histórico.
                  </p>
                ) : null}
              </div>
              {error ? (
                <div role="alert" aria-live="assertive" className={formSurface.messageError}>
                  {error}
                </div>
              ) : null}
            </FormManagementSection>
          </form>
        );
      case 2:
        return formId ? (
          <FormManagementSection
            title={stepMeta.label}
            description="Cadastre cada pergunta e defina, no próprio card dela, a recomendação-base e a aplicabilidade por organização. A recomendação é gerada apenas quando a resposta for Não ou a evidência não for aprovada."
          >
            <FormQuestionsConfigurator formId={formId} />
          </FormManagementSection>
        ) : null;
      case 3:
        return formId ? <FormAssignmentsPanel formId={formId} /> : null;
      case 4:
        return formId ? <FormWizardCycleStep /> : null;
      case 5:
        return formId ? (
          <FormWizardReviewStep
            formId={formId}
            formName={formName || name}
            onReadinessChange={setReadiness}
          />
        ) : null;
      default:
        return null;
    }
  })();

  const footer = (
    <div className="space-y-3">
      {currentStep === 5 && readiness && !canPublish ? (
        <div className={formSurface.messageWarning} role="status">
          <p className="font-medium">A publicação ainda não está disponível.</p>
          <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
            <li>{readiness.checks.hasName ? "✓" : "✕"} Nome do formulário informado</li>
            <li>{readiness.checks.hasQuestions ? "✓" : "✕"} Ao menos uma pergunta cadastrada</li>
            <li>{readiness.checks.bindingsComplete ? "✓" : "✕"} Vínculos das perguntas concluídos</li>
            <li>{readiness.checks.hasAssignments ? "✓" : "✕"} Ao menos uma organização incluída</li>
          </ul>
        </div>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">
        {formId && currentStep > 1 ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleBack}
            className={formSurface.secondaryButton}
          >
            Voltar
          </button>
        ) : (
          <Link href="/admin/formularios" className={formSurface.secondaryButton}>
            Cancelar
          </Link>
        )}
        {currentStep < 5 ? (
          <LoadingButton
            type="button"
            pending={busy}
            pendingLabel="Salvando…"
            onClick={() => void handleNext()}
            className={formSurface.primaryButton}
          >
            Continuar
          </LoadingButton>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 sm:justify-end">
        <LoadingButton
          type="button"
          pending={busy}
          pendingLabel="Salvando…"
          onClick={() => void handleSaveDraft()}
          className={formSurface.secondaryButton}
        >
          Salvar como rascunho
        </LoadingButton>
        {currentStep === 5 && formId ? (
          <LoadingButton
            type="button"
            pending={busy}
            pendingLabel="Publicando…"
            disabled={!canPublish}
            onClick={() => void handlePublish()}
            className={formSurface.primaryButton}
          >
            Publicar formulário
          </LoadingButton>
        ) : null}
      </div>
      </div>
    </div>
  );

  return (
    <FormWizardShell
      backHref={returnTo}
      backLabel="Lista de formulários"
      formName={formId ? formName || name : undefined}
      currentStep={currentStep}
      maxReachableStep={maxReachableStep}
      onStepSelect={formId ? goToStep : undefined}
      footer={footer}
    >
      {stepContent}
      {error && currentStep !== 1 ? (
        <div role="alert" aria-live="assertive" className={`mt-4 max-w-3xl ${formSurface.messageError}`}>{error}</div>
      ) : null}
    </FormWizardShell>
  );
}
