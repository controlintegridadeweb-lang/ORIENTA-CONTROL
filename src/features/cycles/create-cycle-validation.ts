import { parseFortalezaDateTime } from "@/shared/datetime/fortaleza-date-time";

export type CreateCycleLaunchMode = "draft" | "open" | "schedule";
export type CreateCycleFieldName =
  | "formId"
  | "periodLabel"
  | "referenceStartYear"
  | "referenceEndYear"
  | "organizations"
  | "startsAt"
  | "responseDeadlineAt"
  | "validationDeadlineAt"
  | "cycleCloseAt";
export type CreateCycleFieldErrors = Partial<Record<CreateCycleFieldName, string>>;

type Input = {
  formId: string;
  periodLabel: string;
  referenceStartYear: string;
  referenceEndYear: string;
  availableOrganizations: number;
  selectedOrganizations: number;
  launchMode: CreateCycleLaunchMode;
  startsAt: string;
  responseDeadlineAt: string;
  scheduleValidation: boolean;
  validationDeadlineAt: string;
  scheduleClose: boolean;
  cycleCloseAt: string;
  now?: number;
};

export function validateCreateCycleForm(input: Input): CreateCycleFieldErrors {
  const errors: CreateCycleFieldErrors = {};
  if (!input.formId) errors.formId = "Selecione um formulário publicado.";
  if (!input.periodLabel.trim()) errors.periodLabel = "Informe o período do diagnóstico.";
  const referenceStartYear = Number(input.referenceStartYear);
  const referenceEndYear = Number(input.referenceEndYear);
  if (!Number.isInteger(referenceStartYear) || referenceStartYear < 1900 || referenceStartYear > 2199) {
    errors.referenceStartYear = "Informe um ano inicial entre 1900 e 2199.";
  }
  if (!Number.isInteger(referenceEndYear) || referenceEndYear < 1900 || referenceEndYear > 2199) {
    errors.referenceEndYear = "Informe um ano final entre 1900 e 2199.";
  } else if (!errors.referenceStartYear && referenceEndYear < referenceStartYear) {
    errors.referenceEndYear = "O ano final não pode ser anterior ao ano inicial.";
  }
  if (input.formId && input.availableOrganizations === 0) {
    errors.organizations = "Este formulário não possui organizações vinculadas.";
  } else if (input.selectedOrganizations === 0) {
    errors.organizations = "Selecione ao menos uma organização.";
  }
  if (input.launchMode === "draft") return errors;

  const now = input.now ?? Date.now();
  const start = parseFortalezaDateTime(input.startsAt);
  const deadline = parseFortalezaDateTime(input.responseDeadlineAt);
  if (!start) errors.startsAt = "Informe uma data e hora de abertura válidas.";
  if (!deadline) errors.responseDeadlineAt = "Informe um prazo de resposta válido.";

  if (start && deadline && deadline < start) {
    errors.responseDeadlineAt = "O prazo não pode ser anterior à abertura.";
  } else if (deadline && deadline.getTime() <= now) {
    errors.responseDeadlineAt = "O prazo de resposta deve estar no futuro.";
  }
  if (input.launchMode === "schedule" && start && start.getTime() <= now + 5 * 60_000) {
    errors.startsAt = "Agende a abertura para pelo menos cinco minutos no futuro.";
  }

  const validationDeadline = input.scheduleValidation
    ? parseFortalezaDateTime(input.validationDeadlineAt)
    : null;
  if (input.scheduleValidation && !validationDeadline) {
    errors.validationDeadlineAt = "Informe quando a prontidão da validação deve ser verificada automaticamente.";
  } else if (validationDeadline && deadline && validationDeadline < deadline) {
    errors.validationDeadlineAt = "A data deve ser posterior ao prazo de resposta.";
  }

  const closeAt = input.scheduleClose ? parseFortalezaDateTime(input.cycleCloseAt) : null;
  if (input.scheduleClose && !closeAt) {
    errors.cycleCloseAt = "Informe quando o encerramento automático da avaliação deve ser verificado.";
  } else if (closeAt && deadline && closeAt < (validationDeadline ?? deadline)) {
    errors.cycleCloseAt = "A data deve ser posterior à validação programada.";
  }
  return errors;
}
