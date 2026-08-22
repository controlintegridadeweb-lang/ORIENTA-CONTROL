function setIfPresent(params: URLSearchParams, key: string, value: string | undefined): void {
  const normalized = value?.trim();
  if (normalized) params.set(key, normalized);
}

function setOffset(params: URLSearchParams, offset: number | undefined): void {
  if (offset != null && Number.isInteger(offset) && offset > 0) {
    params.set("offset", String(offset));
  }
}

export type RespondentEvidenceListState = {
  search?: string;
  cycleId?: string;
  formId?: string;
  status?: string;
  axisName?: string;
  sectionName?: string;
  pendingOnly?: boolean;
  offset?: number;
};

/** Caminho restaurável da consulta de evidências do respondente. */
export function respondentEvidenceListPath(state: RespondentEvidenceListState): string {
  const params = new URLSearchParams({ view: "all" });
  setIfPresent(params, "search", state.search);
  setIfPresent(params, "cycleId", state.cycleId);
  setIfPresent(params, "formId", state.formId);
  setIfPresent(params, "status", state.status);
  setIfPresent(params, "axisName", state.axisName);
  setIfPresent(params, "sectionName", state.sectionName);
  if (state.pendingOnly) params.set("pendingOnly", "1");
  setOffset(params, state.offset);
  return `/respondente/evidencias?${params.toString()}`;
}

export type AdminEvidenceListState = {
  search?: string;
  cycleId?: string;
  questionId?: string;
  evidenceId?: string;
  formId?: string;
  organizationId?: string;
  status?: string;
  from?: string;
  to?: string;
  offset?: number;
};

/** Caminho restaurável da consulta transversal de evidências da administração. */
export function adminEvidenceListPath(state: AdminEvidenceListState): string {
  const params = new URLSearchParams();
  setIfPresent(params, "search", state.search);
  setIfPresent(params, "cycleId", state.cycleId);
  setIfPresent(params, "questionId", state.questionId);
  setIfPresent(params, "evidenceId", state.evidenceId);
  setIfPresent(params, "formId", state.formId);
  setIfPresent(params, "organizationId", state.organizationId);
  setIfPresent(params, "status", state.status);
  setIfPresent(params, "from", state.from);
  setIfPresent(params, "to", state.to);
  setOffset(params, state.offset);
  const query = params.toString();
  return query ? `/admin/evidencias?${query}` : "/admin/evidencias";
}
