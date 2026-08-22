import Link from "next/link";
import { PencilLine } from "lucide-react";
import {
  FormManagementSection,
  FormTabPanel,
} from "@/features/forms/components/form/form-tab-panel";
import { FormAssignmentsPanel } from "@/features/forms/components/form/form-assignments-panel";
import { formManagementUi } from "@/features/forms/components/form/form-management-ui";
import { diagnosisLabels } from "@/shared/labels/official-labels";
import { formSurface } from "@/shared/layout/form-surface";

type Props = {
  formId: string;
  formName: string;
};

/**
 * Configuração de um formulário já publicado.
 *
 * Criação, edição, renomeação e exclusão de rascunhos pertencem somente ao
 * assistente de publicação. Esta tela não contém ações de rascunho nem zonas
 * de exclusão que não podem ser utilizadas após a publicação.
 */
export function PublishedFormConfig({ formId, formName }: Props) {
  return (
    <FormTabPanel
      title="Configuração do formulário"
      description="Informações do modelo, organizações incluídas e diagnósticos criados a partir dele."
    >
      <div className={formManagementUi.sectionStack}>
        <FormManagementSection
          title="Nome do formulário"
          description="O nome é preservado no histórico. Alterações estruturais são feitas no rascunho da próxima versão."
        >
          <div className={formManagementUi.surface}>
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-base font-medium text-slate-900">{formName}</p>
              <Link
                href={`/admin/formularios/${formId}/configuracao?editar=1`}
                className={`inline-flex w-full items-center justify-center gap-2 sm:w-auto ${formSurface.secondaryButtonSm}`}
              >
                <PencilLine className="h-4 w-4" aria-hidden />
                Preparar nova versão
              </Link>
            </div>
          </div>
        </FormManagementSection>

        <FormManagementSection
          title="Diagnósticos deste formulário"
          description="Cada diagnóstico aplica este formulário a uma organização em um período. Nele acontecem o preenchimento, a validação, o resultado FAMI e o encerramento."
        >
          <div className={formManagementUi.surface}>
            <div className="flex flex-wrap gap-2 p-4">
              <Link
                href={`/admin/formularios/${formId}/estrutura`}
                className={`inline-flex ${formSurface.secondaryButtonSm}`}
              >
                Consultar estrutura publicada
              </Link>
              <Link
                href={`/admin/ciclos?formId=${formId}`}
                className={`inline-flex ${formSurface.primaryButtonSm}`}
              >
                Ver diagnósticos deste formulário
              </Link>
            </div>
            <p
              className={`border-t border-slate-200 px-4 py-3 ${formManagementUi.muted}`}
              title={diagnosisLabels.configHint}
            >
              {diagnosisLabels.configHint}
            </p>
          </div>
        </FormManagementSection>

        <FormAssignmentsPanel formId={formId} />
      </div>
    </FormTabPanel>
  );
}
