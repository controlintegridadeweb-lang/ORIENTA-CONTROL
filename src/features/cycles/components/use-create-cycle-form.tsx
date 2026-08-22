"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createAdminCyclesBatch, type CyclesBatchReport } from "@/features/cycles/client";
import { describeError } from "@/infrastructure/notifications/notify";
import { useConfirm } from "@/shared/ui/components/confirm-dialog";
import { validateCreateCycleForm } from "@/features/cycles/create-cycle-validation";
import {
  asFortalezaIso,
  toFortalezaDateTimeInput,
} from "@/shared/datetime/fortaleza-date-time";
import {
  CREATE_CYCLE_FIELD_ORDER,
  CREATE_CYCLE_FIELD_TARGET,
  DEFAULT_REMINDERS,
  type CreateCycleDraft,
  type CreateCycleFieldErrors,
  type CreateCycleFieldName,
  type CreateCycleFormOption,
  type CreateCycleLaunchMode,
  type CreateCycleOrganizationOption,
  type CreateCycleSelectionMode,
} from "./create-cycle-form-model";

function createInitialDraft(forms: CreateCycleFormOption[], initialFormId?: string): CreateCycleDraft {
  const currentYear = String(new Date().getFullYear());
  return {
    formId: forms.some((form) => form.id === initialFormId) ? initialFormId ?? "" : "",
    periodLabel: "",
    referenceStartYear: currentYear,
    referenceEndYear: currentYear,
    selectionMode: "all",
    selectedOrganizationIds: [],
    launchMode: "draft",
    startsAt: "",
    responseDeadlineAt: "",
    reminderOffsetsDays: [...DEFAULT_REMINDERS],
    scheduleValidation: false,
    validationDeadlineAt: "",
    scheduleClose: false,
    cycleCloseAt: "",
  };
}

function isValidationField(field: string): field is CreateCycleFieldName {
  return Object.hasOwn(CREATE_CYCLE_FIELD_TARGET, field);
}

export function useCreateCycleForm({
  forms,
  organizations,
  initialFormId,
}: {
  forms: CreateCycleFormOption[];
  organizations: CreateCycleOrganizationOption[];
  initialFormId?: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [draft, setDraft] = useState(() => createInitialDraft(forms, initialFormId));
  const [fieldErrors, setFieldErrors] = useState<CreateCycleFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [batchReport, setBatchReport] = useState<CyclesBatchReport | null>(null);

  const selectedForm = useMemo(
    () => forms.find((form) => form.id === draft.formId) ?? null,
    [draft.formId, forms],
  );
  const orgLabelById = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization.label])),
    [organizations],
  );
  const availableOrganizations = useMemo(() => {
    if (!selectedForm) return [];
    const assigned = new Set(selectedForm.organizationIds);
    return organizations.filter((organization) => assigned.has(organization.id));
  }, [organizations, selectedForm]);
  const availableIds = useMemo(
    () => availableOrganizations.map((organization) => organization.id),
    [availableOrganizations],
  );
  const selectedIds =
    draft.selectionMode === "all" ? availableIds : draft.selectedOrganizationIds;
  const selectedSet = useMemo(
    () => new Set(draft.selectedOrganizationIds),
    [draft.selectedOrganizationIds],
  );
  const selectedCount = selectedIds.length;

  function clearFieldError(field: CreateCycleFieldName) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function setField<K extends keyof CreateCycleDraft>(field: K, value: CreateCycleDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (isValidationField(field)) clearFieldError(field);
  }

  function changeForm(formId: string) {
    setDraft((current) => ({
      ...current,
      formId,
      selectionMode: "all",
      selectedOrganizationIds: [],
    }));
    setBatchReport(null);
    setError(null);
    setFieldErrors({});
  }

  function changeLaunchMode(launchMode: CreateCycleLaunchMode) {
    const preservedErrors: CreateCycleFieldErrors = {
      formId: fieldErrors.formId,
      periodLabel: fieldErrors.periodLabel,
      referenceStartYear: fieldErrors.referenceStartYear,
      referenceEndYear: fieldErrors.referenceEndYear,
      organizations: fieldErrors.organizations,
    };
    const scheduleReset = launchMode === "draft"
      ? {
          startsAt: "",
          responseDeadlineAt: "",
          scheduleValidation: false,
          validationDeadlineAt: "",
          scheduleClose: false,
          cycleCloseAt: "",
        }
      : {};
    setDraft((current) => ({
      ...current,
      launchMode,
      ...(launchMode === "open" ? { startsAt: toFortalezaDateTimeInput(new Date()) } : {}),
      ...scheduleReset,
    }));
    setBatchReport(null);
    setError(null);
    setFieldErrors(preservedErrors);
  }

  function changeSelectionMode(selectionMode: CreateCycleSelectionMode) {
    setDraft((current) => ({ ...current, selectionMode }));
    clearFieldError("organizations");
    setBatchReport(null);
  }

  function setSelectedOrganizationIds(selectedOrganizationIds: string[]) {
    setDraft((current) => ({ ...current, selectedOrganizationIds }));
    clearFieldError("organizations");
    setBatchReport(null);
  }

  function toggleReminder(offset: number, checked: boolean) {
    const reminderOffsetsDays = checked
      ? Array.from(new Set([...draft.reminderOffsetsDays, offset])).sort((a, b) => b - a)
      : draft.reminderOffsetsDays.filter((value) => value !== offset);
    setDraft((current) => ({ ...current, reminderOffsetsDays }));
  }

  function validateForm(): CreateCycleFieldErrors {
    return validateCreateCycleForm({
      formId: draft.formId,
      periodLabel: draft.periodLabel,
      referenceStartYear: draft.referenceStartYear,
      referenceEndYear: draft.referenceEndYear,
      availableOrganizations: availableOrganizations.length,
      selectedOrganizations: selectedCount,
      launchMode: draft.launchMode,
      startsAt: draft.startsAt,
      responseDeadlineAt: draft.responseDeadlineAt,
      scheduleValidation: draft.scheduleValidation,
      validationDeadlineAt: draft.validationDeadlineAt,
      scheduleClose: draft.scheduleClose,
      cycleCloseAt: draft.cycleCloseAt,
    });
  }

  function focusFirstInvalidField(errors: CreateCycleFieldErrors) {
    const first = CREATE_CYCLE_FIELD_ORDER.find((field) => errors[field]);
    if (!first) return;
    requestAnimationFrame(() => document.getElementById(CREATE_CYCLE_FIELD_TARGET[first])?.focus());
  }

  async function confirmCreation(): Promise<boolean> {
    const action =
      draft.launchMode === "open"
        ? "criados e abertos agora"
        : draft.launchMode === "schedule"
          ? "criados em rascunho e abertos na data programada"
          : "criados em rascunho";
    return confirm({
      title: `Criar ${selectedCount} diagnóstico${selectedCount === 1 ? "" : "s"}?`,
      description: (
        <p>
          Os diagnósticos serão {action} para o período <strong>{draft.periodLabel.trim()}</strong>.
          Diagnósticos já existentes serão reutilizados apenas quando ainda estiverem em rascunho;
          os demais serão preservados e informados no resultado.
        </p>
      ),
      confirmLabel:
        draft.launchMode === "open"
          ? "Criar e abrir"
          : draft.launchMode === "schedule"
            ? "Criar e agendar"
            : "Criar rascunhos",
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBatchReport(null);

    const validationErrors = validateForm();
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setError("Revise os campos destacados antes de continuar.");
      focusFirstInvalidField(validationErrors);
      return;
    }
    if (!(await confirmCreation())) return;

    setPending(true);
    try {
      const report = await createAdminCyclesBatch({
        formId: draft.formId,
        organizationIds: selectedIds,
        periodLabel: draft.periodLabel.trim(),
        referenceStartYear: Number(draft.referenceStartYear),
        referenceEndYear: Number(draft.referenceEndYear),
        mode: draft.launchMode,
        startsAt: draft.launchMode === "draft" ? null : asFortalezaIso(draft.startsAt),
        responseDeadlineAt:
          draft.launchMode === "draft" ? null : asFortalezaIso(draft.responseDeadlineAt),
        reminderOffsetsDays:
          draft.launchMode === "draft" ? [] : draft.reminderOffsetsDays,
        validationDeadlineAt:
          draft.launchMode !== "draft" && draft.scheduleValidation
            ? asFortalezaIso(draft.validationDeadlineAt)
            : null,
        cycleCloseAt:
          draft.launchMode !== "draft" && draft.scheduleClose
            ? asFortalezaIso(draft.cycleCloseAt)
            : null,
      });
      setBatchReport(report);
      router.refresh();
    } catch (caught) {
      setError(describeError(caught, "Falha ao criar os diagnósticos."));
    } finally {
      setPending(false);
    }
  }

  const submitDisabled =
    !draft.formId ||
    !draft.periodLabel.trim() ||
    !draft.referenceStartYear ||
    !draft.referenceEndYear ||
    selectedCount === 0 ||
    (draft.launchMode !== "draft" && (!draft.startsAt || !draft.responseDeadlineAt));

  return {
    draft,
    setField,
    changeForm,
    changeLaunchMode,
    changeSelectionMode,
    setSelectedOrganizationIds,
    toggleReminder,
    fieldErrors,
    error,
    pending,
    batchReport,
    selectedForm,
    availableOrganizations,
    selectedSet,
    selectedCount,
    orgLabelById,
    submitDisabled,
    handleSubmit,
  };
}

export type CreateCycleFormController = ReturnType<typeof useCreateCycleForm>;
