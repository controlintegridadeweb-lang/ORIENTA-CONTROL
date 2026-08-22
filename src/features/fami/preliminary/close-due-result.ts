import { z } from "zod";

export const closeDuePreliminaryResultSchema = z.object({
  ok: z.boolean(),
  closed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  errors: z.array(
    z.object({
      cycleId: z.string().uuid(),
      referenceYear: z.number().int(),
      quadrimester: z.number().int(),
      error: z.string(),
    }),
  ),
  reason: z.string().optional(),
});

export type CloseDuePreliminaryResult = z.infer<typeof closeDuePreliminaryResultSchema>;

export function parseCloseDuePreliminaryResult(raw: unknown): CloseDuePreliminaryResult {
  const parsed = closeDuePreliminaryResultSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("A rotina de fechamento quadrimestral retornou um contrato inválido.");
  }
  return parsed.data;
}
