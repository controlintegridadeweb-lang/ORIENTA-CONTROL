import { z } from "zod";

/**
 * Decisão administrativa de comprovação (Sim sem documento anexado).
 * Fonte de verdade alinhada a `responses.admin_proof_status` e a `AdminProofStatus`.
 */
export const ADMIN_PROOF_STATUSES = [
  "validated_without_proof",
  "proof_requested",
  "considered_insufficient",
] as const;

export const adminProofStatusSchema = z.enum(ADMIN_PROOF_STATUSES);

export type AdminProofStatusValue = z.infer<typeof adminProofStatusSchema>;
