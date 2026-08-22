import {
  parseFormAdminDecisionFilter,
  parseFormAnalysisSituation,
  parseFormAnswerFilter,
  parseFormProofFilter,
  parseQueueSituationFilter,
  type FormAdminDecisionFilter,
  type FormAnalysisSituation,
  type FormAnswerFilter,
  type FormProofFilter,
  type QueueSituationFilter,
} from "./form-view-model";
import {
  parseValidationPage,
  parseValidationPageSize,
  type ValidationPageSize,
} from "./pagination";

export type SearchParamsRecord = Record<
  string,
  string | string[] | undefined
>;

function firstValue(
  searchParams: SearchParamsRecord,
  key: string,
): string | undefined {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function optionalId(value: string | undefined): string | null {
  return value && value !== "all" ? value : null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalUuid(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized && UUID_PATTERN.test(normalized) ? normalized : null;
}

export function resolveValidationQueueQuery(
  searchParams: SearchParamsRecord,
): {
  mode: "fila";
  queueSituation: QueueSituationFilter;
  sectionId: string | null;
  axisId: string | null;
  search: string;
  page: number;
  pageSize: ValidationPageSize;
  targetEvidenceId: string | null;
} {
  return {
    mode: "fila",
    queueSituation: parseQueueSituationFilter(
      firstValue(searchParams, "situacao") ??
        firstValue(searchParams, "visao") ??
        firstValue(searchParams, "escopo"),
    ),
    sectionId: optionalId(firstValue(searchParams, "secao")),
    axisId: optionalId(firstValue(searchParams, "eixo")),
    search: (firstValue(searchParams, "busca") ?? "").trim(),
    page: parseValidationPage(firstValue(searchParams, "pagina")),
    pageSize: parseValidationPageSize(
      firstValue(searchParams, "porPagina"),
    ),
    targetEvidenceId: optionalUuid(firstValue(searchParams, "evidenceId")),
  };
}

export function resolveValidationFormQuery(
  searchParams: SearchParamsRecord,
): {
  mode: "formulario";
  sectionId: string | null;
  axisId: string | null;
  answer: FormAnswerFilter;
  situation: FormAnalysisSituation;
  decision: FormAdminDecisionFilter;
  proof: FormProofFilter;
  search: string;
  page: number;
  pageSize: ValidationPageSize;
  filaReturnQuery: string;
} {
  return {
    mode: "formulario",
    sectionId: optionalId(firstValue(searchParams, "secao")),
    axisId: optionalId(firstValue(searchParams, "eixo")),
    answer: parseFormAnswerFilter(firstValue(searchParams, "resposta")),
    situation: parseFormAnalysisSituation(
      firstValue(searchParams, "situacao"),
    ),
    decision: parseFormAdminDecisionFilter(
      firstValue(searchParams, "decisao"),
    ),
    proof: parseFormProofFilter(firstValue(searchParams, "comprovacao")),
    search: (firstValue(searchParams, "busca") ?? "").trim(),
    page: parseValidationPage(firstValue(searchParams, "pagina")),
    pageSize: parseValidationPageSize(
      firstValue(searchParams, "porPagina"),
    ),
    filaReturnQuery: (firstValue(searchParams, "fila") ?? "").trim(),
  };
}
