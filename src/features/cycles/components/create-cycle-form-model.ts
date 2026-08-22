import type {
  CreateCycleFieldErrors as ValidationFieldErrors,
  CreateCycleFieldName as ValidationFieldName,
  CreateCycleLaunchMode as ValidationLaunchMode,
} from "@/features/cycles/create-cycle-validation";

export type CreateCycleFormOption = {
  id: string;
  label: string;
  organizationIds: string[];
};

export type CreateCycleOrganizationOption = { id: string; label: string };
export type CreateCycleSelectionMode = "all" | "specific";

export type CreateCycleFormProps = {
  forms: CreateCycleFormOption[];
  organizations: CreateCycleOrganizationOption[];
  initialFormId?: string;
  publishedNow?: boolean;
};

export type CreateCycleDraft = {
  formId: string;
  periodLabel: string;
  referenceStartYear: string;
  referenceEndYear: string;
  selectionMode: CreateCycleSelectionMode;
  selectedOrganizationIds: string[];
  launchMode: ValidationLaunchMode;
  startsAt: string;
  responseDeadlineAt: string;
  reminderOffsetsDays: number[];
  scheduleValidation: boolean;
  validationDeadlineAt: string;
  scheduleClose: boolean;
  cycleCloseAt: string;
};

export type CreateCycleFieldErrors = ValidationFieldErrors;
export type CreateCycleFieldName = ValidationFieldName;
export type CreateCycleLaunchMode = ValidationLaunchMode;

export const DEFAULT_REMINDERS = [7, 3, 0] as const;

export const CREATE_CYCLE_FIELD_ORDER: ValidationFieldName[] = [
  "formId",
  "periodLabel",
  "referenceStartYear",
  "referenceEndYear",
  "organizations",
  "startsAt",
  "responseDeadlineAt",
  "validationDeadlineAt",
  "cycleCloseAt",
];

export const CREATE_CYCLE_FIELD_TARGET: Record<ValidationFieldName, string> = {
  formId: "cycle-form",
  periodLabel: "cycle-period",
  referenceStartYear: "cycle-reference-start-year",
  referenceEndYear: "cycle-reference-end-year",
  organizations: "cycle-organizations-search",
  startsAt: "cycle-start",
  responseDeadlineAt: "cycle-deadline",
  validationDeadlineAt: "validation-deadline",
  cycleCloseAt: "cycle-close-at",
};
