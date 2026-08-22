import { z } from "zod";

export const validationDraftTargetKindSchema = z.enum([
  "evidence",
  "not_applicable",
  "absent_proof",
  "admin_not_applicable",
]);

export type ValidationDraftTargetKind = z.infer<
  typeof validationDraftTargetKindSchema
>;

export const validationAnalysisDraftSchema = z.object({
  id: z.string().uuid(),
  cycleId: z.string().uuid(),
  targetKind: validationDraftTargetKindSchema,
  evidenceId: z.string().uuid().nullable(),
  responseId: z.string().uuid().nullable(),
  action: z.string().nullable(),
  justification: z.string().nullable(),
  notes: z.string().nullable(),
  revision: z.number().int().positive(),
  updatedAt: z.string(),
  appliedAt: z.string().nullable().optional(),
  unchanged: z.boolean().optional(),
});

export type ValidationAnalysisDraft = z.infer<
  typeof validationAnalysisDraftSchema
>;

export type ValidationAnalysisDraftView = {
  id: string;
  targetKind: ValidationDraftTargetKind;
  evidenceId: string | null;
  responseId: string | null;
  action: string | null;
  justification: string | null;
  notes: string | null;
  revision: number;
  updatedAt: string;
};

export function draftTargetKey(
  targetKind: ValidationDraftTargetKind,
  evidenceId: string | null | undefined,
  responseId: string | null | undefined,
): string {
  if (targetKind === "evidence") {
    return `evidence:${evidenceId ?? ""}`;
  }
  return `${targetKind}:${responseId ?? ""}`;
}

export function isDraftPayloadUnchanged(
  persisted: Pick<
    ValidationAnalysisDraftView,
    "action" | "justification" | "notes"
  > | null,
  next: {
    action: string | null;
    justification: string | null;
    notes: string | null;
  },
): boolean {
  if (!persisted) {
    return (
      next.action === null &&
      (next.justification ?? null) === null &&
      (next.notes ?? null) === null
    );
  }
  return (
    (persisted.action ?? null) === (next.action ?? null) &&
    (persisted.justification ?? null) === (next.justification ?? null) &&
    (persisted.notes ?? null) === (next.notes ?? null)
  );
}
