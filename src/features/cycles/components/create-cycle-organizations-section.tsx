import { OrganizationMultiSelect } from "@/features/organizations";
import { formSurface } from "@/shared/layout/form-surface";
import { ChoiceCard, FlowSection } from "./create-cycle-form-fields";
import type { CreateCycleFormController } from "./use-create-cycle-form";

export function CreateCycleOrganizationsSection({
  controller,
}: {
  controller: CreateCycleFormController;
}) {
  const {
    draft,
    selectedForm,
    availableOrganizations,
    selectedSet,
    fieldErrors,
    pending,
    changeSelectionMode,
    setSelectedOrganizationIds,
  } = controller;

  return (
    <FlowSection number={2} title="Organizações participantes">
      {!selectedForm ? (
        <p className="text-sm text-slate-600">Selecione primeiro o formulário.</p>
      ) : availableOrganizations.length === 0 ? (
        <p id="cycle-organizations-error" className={formSurface.messageWarning}>
          Nenhuma organização está vinculada a este formulário. Faça o vínculo em Formulários antes de criar diagnósticos.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              name="selection-mode"
              checked={draft.selectionMode === "all"}
              onChange={() => changeSelectionMode("all")}
              title={`Todas as organizações vinculadas (${availableOrganizations.length})`}
              description="Usa a seleção oficial mantida no formulário."
            />
            <ChoiceCard
              name="selection-mode"
              checked={draft.selectionMode === "specific"}
              onChange={() => changeSelectionMode("specific")}
              title="Organizações específicas"
              description="Escolha uma ou várias entre as já vinculadas."
            />
          </div>

          {draft.selectionMode === "specific" ? (
            <>
              <OrganizationMultiSelect
                options={availableOrganizations}
                selectedIds={selectedSet}
                onChange={(next) => setSelectedOrganizationIds(Array.from(next))}
                disabled={pending}
                ariaLabel="Organizações participantes do diagnóstico"
                searchInputId="cycle-organizations-search"
                ariaDescribedBy={fieldErrors.organizations ? "cycle-organizations-error" : undefined}
                invalid={Boolean(fieldErrors.organizations)}
              />
              {fieldErrors.organizations ? (
                <p id="cycle-organizations-error" role="alert" className="text-xs text-rose-700">
                  {fieldErrors.organizations}
                </p>
              ) : null}
            </>
          ) : fieldErrors.organizations ? (
            <p id="cycle-organizations-error" role="alert" className="text-xs text-rose-700">
              {fieldErrors.organizations}
            </p>
          ) : null}
        </>
      )}
    </FlowSection>
  );
}
