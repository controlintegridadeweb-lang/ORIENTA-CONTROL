export const FORM_WIZARD_STEPS = [
  {
    id: 1,
    key: "basico",
    label: "Informações básicas",
    shortLabel: "Básico",
  },
  {
    id: 2,
    key: "perguntas-configuracoes",
    label: "Perguntas e configurações",
    shortLabel: "Perguntas",
  },
  {
    id: 3,
    key: "organizacoes",
    label: "Organizações",
    shortLabel: "Organizações",
  },
  {
    id: 4,
    key: "proximos-passos",
    label: "Próximos passos",
    shortLabel: "Próximas",
  },
  {
    id: 5,
    key: "revisao",
    label: "Revisão e publicação",
    shortLabel: "Revisão",
  },
] as const;

export type FormWizardStepId = (typeof FORM_WIZARD_STEPS)[number]["id"];

export type WizardStepStatus = "current" | "complete" | "available" | "locked";

export function wizardStepStatus(
  stepId: FormWizardStepId,
  currentStep: FormWizardStepId,
  maxReachableStep: FormWizardStepId,
): WizardStepStatus {
  if (stepId === currentStep) return "current";
  if (stepId < currentStep) return "complete";
  if (stepId <= maxReachableStep) return "available";
  return "locked";
}

const FORM_WIZARD_STEP_COUNT = FORM_WIZARD_STEPS.length;

export function parseWizardStep(raw: string | null | undefined): FormWizardStepId {
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 1 && n <= FORM_WIZARD_STEP_COUNT) {
    return n as FormWizardStepId;
  }
  return 1;
}

export function wizardStepHref(formId: string, step: FormWizardStepId): string {
  return `/admin/formularios/${formId}/configuracao?etapa=${step}`;
}

export function resolveWizardStepAccess(
  requestedStep: FormWizardStepId,
  visitedStep: FormWizardStepId,
): { currentStep: FormWizardStepId; maxReachableStep: FormWizardStepId } {
  return {
    currentStep: Math.min(requestedStep, visitedStep) as FormWizardStepId,
    maxReachableStep: visitedStep,
  };
}

export function wizardProgressStorageKey(formId: string): string {
  return `orienta:form-wizard:${formId}:max-visited`;
}

/**
 * Reconstrói a etapa alcançada a partir de dados persistidos no servidor.
 * O sessionStorage é apenas uma conveniência da aba atual; nunca a fonte de
 * verdade para retomar um rascunho.
 */
export function derivePersistedWizardStep(input: {
  questionCount: number;
  bindingsComplete: boolean;
  assignmentCount: number;
}): FormWizardStepId {
  if (input.questionCount <= 0 || !input.bindingsComplete) return 2;
  if (input.assignmentCount <= 0) return 3;
  return 4;
}
