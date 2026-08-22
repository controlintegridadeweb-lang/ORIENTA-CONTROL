/** Tamanhos de página permitidos na fila de validação. */
export const VALIDATION_PAGE_SIZES = [10, 20, 50] as const;
export type ValidationPageSize = (typeof VALIDATION_PAGE_SIZES)[number];
export const DEFAULT_VALIDATION_PAGE_SIZE: ValidationPageSize = 10;

export type ValidationQueueKind = "evidencias" | "nao-se-aplica";

export function parseValidationQueueKind(
  value: string | null | undefined,
): ValidationQueueKind {
  return value === "nao-se-aplica" ? "nao-se-aplica" : "evidencias";
}

export function parseValidationPageSize(
  value: string | null | undefined,
): ValidationPageSize {
  const parsed = Number(value);
  return (VALIDATION_PAGE_SIZES as readonly number[]).includes(parsed)
    ? (parsed as ValidationPageSize)
    : DEFAULT_VALIDATION_PAGE_SIZE;
}

export function parseValidationPage(
  value: string | null | undefined,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.trunc(parsed);
}

export function totalPagesFor(totalItems: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, totalItems) / Math.max(1, pageSize)));
}

export function clampValidationPage(
  page: number,
  totalItems: number,
  pageSize: number,
): number {
  const totalPages = totalPagesFor(totalItems, pageSize);
  return Math.min(Math.max(1, Math.trunc(page)), totalPages);
}
