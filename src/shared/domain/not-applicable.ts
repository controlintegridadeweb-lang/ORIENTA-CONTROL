import type { AnswerValue } from "./types";

export type NaValidationStatus = "pending" | "approved" | "rejected";
export type AdminApplicabilityStatus = "not_applicable";

export const NA_JUSTIFICATION_MIN_LENGTH = 20;
export const ADMIN_NA_JUSTIFICATION_MIN_LENGTH = 1;

/**
 * N/A efetivo para FAMI/recomendação:
 * - respondente com N/A aprovado pela administração; ou
 * - classificação administrativa “Não se aplica” (preserva a resposta original).
 * Pendente do respondente ainda conta como resposta no envio, mas permanece elegível.
 */
export function isEffectiveNotApplicable(input: {
  answer?: AnswerValue | null;
  isNotApplicable?: boolean;
  naValidationStatus?: NaValidationStatus | null;
  adminApplicabilityStatus?: AdminApplicabilityStatus | null;
}): boolean {
  if (input.adminApplicabilityStatus === "not_applicable") return true;
  if (input.answer !== "not_applicable") return false;
  return input.naValidationStatus === "approved";
}

export function validateAdminNaJustification(
  value: string | null | undefined,
): { ok: true; justification: string } | { ok: false; message: string } {
  const justification = (value ?? "").trim();
  if (justification.length < ADMIN_NA_JUSTIFICATION_MIN_LENGTH) {
    return {
      ok: false,
      message: "Informe a justificativa da decisão.",
    };
  }
  return { ok: true, justification };
}

export function validateNaJustification(
  value: string | null | undefined,
): { ok: true; justification: string } | { ok: false; message: string } {
  const justification = (value ?? "").trim();
  if (justification.length < NA_JUSTIFICATION_MIN_LENGTH) {
    return {
      ok: false,
      message: `Informe a justificativa com ao menos ${NA_JUSTIFICATION_MIN_LENGTH} caracteres.`,
    };
  }
  return { ok: true, justification };
}
