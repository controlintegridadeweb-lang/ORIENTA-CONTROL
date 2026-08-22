export type RespondentFamiTab = "panorama" | "eixos" | "secoes" | "evolucao";
export type AdminFamiTab = "resumo" | "eixos" | "secoes" | "evolucao";

function setIfPresent(params: URLSearchParams, key: string, value: string | null | undefined): void {
  const normalized = value?.trim();
  if (normalized) params.set(key, normalized);
}

function setYear(params: URLSearchParams, year: number | null | undefined): void {
  if (year != null && Number.isInteger(year) && year >= 2000 && year <= 2200) {
    params.set("year", String(year));
  }
}

export function respondentFamiPath(input: {
  cycleId?: string | null;
  year?: number | null;
  tab?: RespondentFamiTab;
}): string {
  const params = new URLSearchParams();
  setIfPresent(params, "cycleId", input.cycleId);
  setYear(params, input.year);
  if (input.tab && input.tab !== "panorama") params.set("tab", input.tab);
  const query = params.toString();
  return query ? `/respondente/pontuacao-fami?${query}` : "/respondente/pontuacao-fami";
}

export function adminFamiPath(input: {
  organizationId?: string | null;
  formId?: string | null;
  cycleId?: string | null;
  year?: number | null;
  tab?: AdminFamiTab;
}): string {
  const params = new URLSearchParams();
  setIfPresent(params, "organizationId", input.organizationId);
  setIfPresent(params, "formId", input.formId);
  setIfPresent(params, "cycleId", input.cycleId);
  setYear(params, input.year);
  if (input.tab && input.tab !== "resumo") params.set("tab", input.tab);
  const query = params.toString();
  return query ? `/admin/maturidade?${query}` : "/admin/maturidade";
}
