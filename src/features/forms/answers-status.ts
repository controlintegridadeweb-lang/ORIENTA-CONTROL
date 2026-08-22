import { isCyclePastResponsePhase } from "@/shared/domain/workflow";
import type { RespondentStatus } from "./answers-types";

/**
 * Deriva o status agregado de uma organização em um diagnóstico.
 *
 * - `answered` / `total`: contagem em `responses` versus `form_questions`.
 * - `cycleState`: estado global do diagnóstico (não usa `fami_results`).
 * - `hasComplementationRequested`: evidência com validação `adjustment_requested`.
 */
export function deriveValidationStatus(input: {
  answered: number;
  total: number;
  applicableTotal?: number;
  cycleState: string;
  hasComplementationRequested: boolean;
}): RespondentStatus {
  const { answered, total, hasComplementationRequested, cycleState } = input;
  const applicable = input.applicableTotal ?? total;

  if (hasComplementationRequested) return "em_complementacao";
  if (answered <= 0) return "nao_iniciada";

  const allApplicableAnswered = applicable > 0 && answered >= applicable;

  if (allApplicableAnswered && isCyclePastResponsePhase(cycleState)) {
    return "submetida";
  }
  if (allApplicableAnswered) return "completa";
  return "em_preenchimento";
}
