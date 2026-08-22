import type {
  AbsentProofDecisionAction,
  EvidenceDecisionAction,
} from "./contracts";

/**
 * No rodapé unificado, os botões usam os rótulos de evidência.
 * Sem documento (Sim ausente ou Não elegível), o veredito cai na RPC
 * decide_response_without_proof.
 */
export function evidenceVerdictToAbsentProofAction(
  action: EvidenceDecisionAction,
): AbsentProofDecisionAction {
  if (action === "approve") return "validate_without_proof";
  if (action === "invalidate") return "consider_insufficient";
  return "request_proof";
}
