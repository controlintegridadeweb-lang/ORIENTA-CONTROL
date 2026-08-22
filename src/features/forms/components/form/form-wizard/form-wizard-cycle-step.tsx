"use client";

import { diagnosisLabels } from "@/shared/labels/official-labels";
import { FormManagementSection } from "@/features/forms/components/form/form-tab-panel";
import { formManagementUi } from "@/features/forms/components/form/form-management-ui";

/**
 * Etapa 4 — próximos passos para disponibilização em diagnósticos.
 *
 * O prazo de resposta não é definido no modelo de formulário: ele pertence ao
 * diagnóstico, criado para cada organização e período. Esta etapa apenas orienta
 * o administrador; não grava prazo no formulário.
 */
export function FormWizardCycleStep() {
  return (
    <FormManagementSection
      title="Próximos passos após a publicação"
      description="O formulário é um modelo. Depois de publicá-lo, crie um diagnóstico para cada organização e período, definindo o início e o prazo de resposta."
    >
      <div className={formManagementUi.surface}>
        <div className="space-y-3 p-4">
          <p className="text-sm text-slate-700">
            Ao publicar este formulário, ele fica disponível como versão para novos diagnósticos.
            Cada diagnóstico (organização + período) define seu próprio prazo de resposta em{" "}
            <span className="font-medium">Diagnósticos</span>.
          </p>
          <p className="border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-500" title={diagnosisLabels.configHint}>
            {diagnosisLabels.configHint}
          </p>
          <p className="text-xs text-slate-500">
            Os ajustes solicitados em evidências seguem a Regra Oficial após o envio das respostas
            e a validação de evidências.
          </p>
        </div>
      </div>
    </FormManagementSection>
  );
}
