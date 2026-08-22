type EvidenceFilterKey =
  | "cycleId"
  | "questionId"
  | "formId"
  | "organizationId"
  | "status"
  | "search"
  | "from"
  | "to"
  | "axisName"
  | "sectionName"
  | "ids"
  | "limit"
  | "offset";

const BASE_FILTER_KEYS = [
  "cycleId",
  "questionId",
  "formId",
  "organizationId",
  "search",
  "from",
  "to",
  "axisName",
  "sectionName",
  "ids",
] as const satisfies readonly EvidenceFilterKey[];

function pickSearchParams(
  searchParams: URLSearchParams,
  keys: readonly EvidenceFilterKey[],
): Record<string, string | undefined> {
  return Object.fromEntries(
    keys.map((key) => [key, searchParams.get(key) ?? undefined]),
  );
}

/** Contrato HTTP único para listagem de evidências. */
export function evidenceListFiltersFromSearchParams(
  searchParams: URLSearchParams,
): Record<string, string | undefined> {
  return pickSearchParams(searchParams, [
    ...BASE_FILTER_KEYS,
    "status",
    "limit",
    "offset",
  ]);
}

/**
 * Indicadores ignoram apenas o status selecionado para manter a decomposição
 * completa, mas preservam exatamente o restante do escopo visível da tela.
 */
export function evidenceStatsFiltersFromSearchParams(
  searchParams: URLSearchParams,
): Record<string, string | undefined> {
  return pickSearchParams(searchParams, BASE_FILTER_KEYS);
}

/** Exportação preserva todos os filtros aplicáveis à lista, sem paginação. */
export function evidenceExportFiltersFromSearchParams(
  searchParams: URLSearchParams,
): Record<string, string | undefined> {
  return pickSearchParams(searchParams, [...BASE_FILTER_KEYS, "status"]);
}
