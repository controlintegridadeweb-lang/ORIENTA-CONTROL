"use client";

import { useCallback, useEffect, useState } from "react";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { InlineLoader, LoadingButton } from "@/shared/ui/components/loading";
import { FormManagementSection } from "@/features/forms/components/form/form-tab-panel";
import { OrganizationMultiSelect } from "@/features/organizations";
import { formSurface } from "@/shared/layout/form-surface";
import { organizationLabels } from "@/shared/labels/official-labels";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import {
  getFormAssignments,
  syncFormAssignments,
  type FormAssignmentOrganizationOption,
} from "@/features/forms/client";

export function FormAssignmentsPanel({ formId }: { formId: string }) {
  const [organizations, setOrganizations] = useState<FormAssignmentOrganizationOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const lockedIds = new Set(
    organizations.filter((organization) => organization.locked).map((organization) => organization.id),
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getFormAssignments(formId);
      setOrganizations(data.organizations);
      setSelected(new Set(data.organizations.filter((organization) => organization.assigned).map((organization) => organization.id)));
    } catch (caught) {
      setLoadError(describeError(caught, "Falha ao carregar organizações incluídas."));
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Inicia a leitura assíncrona da API para o formulário atual; os setters ocorrem na continuação da requisição.
    void load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await syncFormAssignments(formId, Array.from(selected));
      notify.success("Seleção de organizações salva.");
      await load();
    } catch (caught) {
      setSaveError(describeError(caught, "Falha ao salvar organizações incluídas."));
    } finally {
      setSaving(false);
    }
  }

  const initialLoadFailed = Boolean(loadError && organizations.length === 0);

  return (
    <FormManagementSection
      title="Organizações"
      description="Selecione as organizações que participarão do formulário."
    >
      {loadError ? (
        <AsyncErrorState
          compact
          title={organizations.length > 0 ? "A seleção pode estar desatualizada" : undefined}
          message={loadError}
          onRetry={load}
          retrying={loading}
        />
      ) : null}

      {loading && organizations.length === 0 ? (
        <InlineLoader label={`Carregando ${organizationLabels.plural.toLowerCase()}…`} />
      ) : initialLoadFailed ? null : organizations.length === 0 ? (
        <p className={formSurface.messageNeutral}>
          {`Nenhuma ${organizationLabels.singular.toLowerCase()} cadastrada na plataforma.`}
        </p>
      ) : (
        <OrganizationMultiSelect
          options={organizations.map((organization) => ({
            id: organization.id,
            label: organization.name,
            locked: organization.locked,
            lockedLabel: "Possui diagnóstico",
          }))}
          selectedIds={selected}
          onChange={(next) => {
            setSaveError(null);
            const preserved = new Set(next);
            for (const id of lockedIds) preserved.add(id);
            setSelected(preserved);
          }}
          disabled={saving || loading}
          ariaLabel="Organizações incluídas no formulário"
          footerActions={
            <LoadingButton
              type="button"
              pending={saving}
              pendingLabel="Salvando seleção…"
              className={`${formSurface.primaryButton} w-full sm:w-auto`}
              disabled={loading || initialLoadFailed || organizations.length === 0}
              onClick={() => void handleSave()}
            >
              Salvar seleção
            </LoadingButton>
          }
        />
      )}

      {saveError ? (
        <p role="alert" aria-live="assertive" className={formSurface.messageError}>
          {saveError}
        </p>
      ) : null}
    </FormManagementSection>
  );
}
