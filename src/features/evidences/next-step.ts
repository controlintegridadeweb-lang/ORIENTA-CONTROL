import type { CycleState } from "@/shared/domain/types";
import type { ValidationStatus } from "@/features/evidences/schemas";

export type EvidenceNextStep = {
  label: string;
  description: string;
  opensValidationQueue: boolean;
};

/**
 * Define o único próximo passo permitido a partir da consulta transversal de
 * evidências. A fila oficial só é acessível quando o diagnóstico está em
 * validação e o item é elegível à fila (não é N/A administrativo).
 */
export function evidenceNextStep(
  cycleState: CycleState,
  currentStatus?: ValidationStatus | null,
): EvidenceNextStep {
  if (currentStatus === "not_required") {
    return {
      label: "Ver diagnóstico de origem",
      description:
        "Este critério foi marcado como não se aplica pela administração. A comprovação permanece no histórico, mas não entra na fila de validação e não impede a conclusão do diagnóstico.",
      opensValidationQueue: false,
    };
  }

  switch (cycleState) {
    case "in_validation":
      return {
        label: "Abrir fila de validação deste diagnóstico",
        description:
          "A aprovação, a não aprovação e a solicitação de ajuste são decididas na fila oficial deste diagnóstico.",
        opensValidationQueue: true,
      };
    case "submitted":
      return {
        label: "Ver diagnóstico enviado",
        description: "O diagnóstico foi enviado e ainda aguarda o início da validação.",
        opensValidationQueue: false,
      };
    case "awaiting_adjustment":
      return {
        label: "Ver diagnóstico aguardando correção",
        description: "O respondente está corrigindo pendências antes de um novo envio.",
        opensValidationQueue: false,
      };
    case "validated":
      return {
        label: "Ver diagnóstico concluído",
        description: "A validação foi concluída; FAMI, recomendações oficiais e plano de ação estão disponíveis.",
        opensValidationQueue: false,
      };
    case "completed":
      return {
        label: "Ver avaliação encerrada",
        description: "A avaliação do diagnóstico foi encerrada; o Resultado FAMI permanece preservado e o plano de ação continua disponível para acompanhamento.",
        opensValidationQueue: false,
      };
    case "draft":
      return {
        label: "Ver diagnóstico em rascunho",
        description: "O diagnóstico ainda não foi aberto para preenchimento.",
        opensValidationQueue: false,
      };
    case "in_response":
      return {
        label: "Ver diagnóstico em preenchimento",
        description: "O respondente ainda está preenchendo ou revisando as respostas.",
        opensValidationQueue: false,
      };
  }
}
