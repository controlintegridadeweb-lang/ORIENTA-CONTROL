import { isActionPlanEligible } from "@/shared/domain/workflow";

export type ActionPlanAvailability = {
  title: string;
  description: string;
};

/**
 * Explica por que o plano de ação ainda não pode ser iniciado.
 * A regra de elegibilidade permanece centralizada em `isActionPlanEligible`;
 * esta função apenas traduz o estado para uma orientação de interface coerente.
 */
export function actionPlanAvailabilityForCycleState(
  cycleState: string | null | undefined,
): ActionPlanAvailability | null {
  if (isActionPlanEligible(cycleState)) return null;

  switch (cycleState) {
    case "draft":
      return {
        title: "Diagnóstico ainda não aberto",
        description:
          "O plano de ação será liberado depois que o diagnóstico for aberto, respondido, validado e consolidado.",
      };
    case "in_response":
      return {
        title: "Aguardando envio do diagnóstico",
        description:
          "O plano de ação será liberado depois do envio, da validação e da consolidação do diagnóstico.",
      };
    case "awaiting_adjustment":
      return {
        title: "Correções do diagnóstico pendentes",
        description:
          "As correções solicitadas precisam ser concluídas antes de o diagnóstico retornar à validação e seguir para a consolidação.",
      };
    case "submitted":
    case "in_validation":
      return {
        title: "Aguardando validação",
        description:
          "O plano de ação será liberado após a administração validar e consolidar o diagnóstico.",
      };
    case "completed":
      return {
        title: "Acompanhamento encerrado",
        description:
          "As ações e os pareceres estão disponíveis somente para consulta. Para iniciar uma nova execução, reabra formalmente o diagnóstico.",
      };
    default:
      return {
        title: "Plano de ação indisponível",
        description:
          "O plano de ação será liberado quando o diagnóstico alcançar a etapa de consolidação.",
      };
  }
}
