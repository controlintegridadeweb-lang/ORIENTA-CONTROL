import { z } from "zod";
import {
  catalogDownloadPath,
  REPORT_CATALOG_KINDS,
} from "@/features/reports/report-catalog";

export const reportCatalogKindSchema = z.enum(REPORT_CATALOG_KINDS);

export const reportHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  cycle_id: z.string().uuid(),
  cycle_processing_id: z.string().uuid(),
  generated_by: z.string().uuid().nullable(),
  generated_by_name: z.string().nullable(),
  generated_at: z.string(),
  emission_version: z.number().int().positive(),
  reissue_reason: z.string().nullable(),
  processing_version: z.number().int().positive(),
  fami_policy_version: z.string().min(1),
  organization_id: z.string().uuid(),
  period_label: z.string().nullable(),
  form_id: z.string().uuid(),
  form_version: z.number().int().positive(),
  form_name: z.string(),
  latest_processing_version: z.number().int().positive(),
  latest_emission_version: z.number().int().positive(),
  is_current: z.boolean(),
  file_sha256: z.string().nullable(),
  content_sha256: z.string().nullable(),
  file_size_bytes: z.number().nullable(),
  reference_start_year: z.number().int().nullable(),
  reference_end_year: z.number().int().nullable(),
  cycle_state: z.string(),
  report_action_plan_revision: z.number().nullable(),
  current_action_plan_revision: z.number(),
  current_reference_start_year: z.number().int().nullable(),
  current_reference_end_year: z.number().int().nullable(),
  report_kind: reportCatalogKindSchema,
  bimester: z.number().int().min(1).max(6).nullable(),
  generation_kind: z.enum(["manual", "automatic"]).nullable(),
});

export type ReportHistoryEntryRow = z.infer<typeof reportHistoryEntrySchema>;

export const REPORT_HISTORY_SELECT =
  "id,cycle_id,cycle_processing_id,generated_by,generated_by_name,generated_at,emission_version,reissue_reason,processing_version,fami_policy_version,organization_id,period_label,form_id,form_version,form_name,latest_processing_version,latest_emission_version,is_current,file_sha256,content_sha256,file_size_bytes,reference_start_year,reference_end_year,cycle_state,report_action_plan_revision,current_action_plan_revision,current_reference_start_year,current_reference_end_year,report_kind,bimester,generation_kind";

export function catalogOutdatedReason(row: ReportHistoryEntryRow): string | null {
  if (row.is_current) return null;
  if (row.report_kind === "bimonthly") {
    return row.emission_version !== row.latest_emission_version
      ? "Esta emissão foi substituída por uma versão posterior."
      : "Esta emissão não representa mais o estado atual do bimestre.";
  }
  if (row.cycle_state !== "completed") {
    return "O diagnóstico foi reaberto após esta emissão.";
  }
  if (
    row.reference_start_year !== row.current_reference_start_year ||
    row.reference_end_year !== row.current_reference_end_year
  ) {
    return "A referência institucional do diagnóstico diverge desta emissão.";
  }
  if (row.report_action_plan_revision !== row.current_action_plan_revision) {
    return "O plano de integridade e compliance foi alterado após esta emissão.";
  }
  if (row.processing_version !== row.latest_processing_version) {
    return "Existe um processamento posterior deste diagnóstico.";
  }
  if (row.emission_version !== row.latest_emission_version) {
    return "Esta emissão foi substituída por uma versão posterior.";
  }
  if (!row.file_sha256) {
    return "Emissão legada sem verificação criptográfica.";
  }
  return "Esta emissão não representa mais o estado atual do diagnóstico.";
}

export function mapHistoryEntry(row: ReportHistoryEntryRow) {
  return {
    id: row.id,
    cycleId: row.cycle_id,
    cycleProcessingId: row.cycle_processing_id,
    formId: row.form_id,
    formName: row.form_name,
    formVersion: row.form_version,
    organizationId: row.organization_id,
    periodLabel: row.period_label ?? "",
    processingVersion: row.processing_version,
    policyVersion: row.fami_policy_version,
    latestProcessingVersion: row.latest_processing_version,
    emissionVersion: row.emission_version,
    latestEmissionVersion: row.latest_emission_version,
    isCurrent: row.is_current,
    reissueReason: row.reissue_reason,
    fileSha256: row.file_sha256,
    contentSha256: row.content_sha256,
    fileSizeBytes: row.file_size_bytes,
    referenceStartYear: row.reference_start_year,
    referenceEndYear: row.reference_end_year,
    catalogKind: row.report_kind,
    bimester: row.bimester,
    generationKind: row.generation_kind,
    outdatedReason: catalogOutdatedReason(row),
    generatedBy: row.generated_by,
    generatedByLabel: row.generated_by_name?.trim() || "Administração da plataforma",
    generatedAt: row.generated_at,
    downloadPath: catalogDownloadPath(row.report_kind, row.id),
  };
}

function catalogSaoPauloYear(iso: string): number {
  const year = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
    }).format(new Date(iso)),
  );
  return Number.isInteger(year) ? year : 0;
}

/** Identidade do card visível no histórico: formulário + período + tipo + bimestre. */
export function catalogHistoryGroupKey(
  row: Pick<
    ReportHistoryEntryRow,
    | "organization_id"
    | "form_id"
    | "report_kind"
    | "reference_start_year"
    | "reference_end_year"
    | "bimester"
    | "generated_at"
  >,
): string {
  const startYear = row.reference_start_year ?? catalogSaoPauloYear(row.generated_at);
  const endYear = row.reference_end_year ?? startYear;
  const bimester = row.report_kind === "bimonthly" ? (row.bimester ?? 0) : 0;
  return [row.organization_id, row.form_id, row.report_kind, startYear, endYear, bimester].join("\u001f");
}

function isCatalogRecencyGreater(
  candidate: Pick<
    ReportHistoryEntryRow,
    "report_kind" | "processing_version" | "emission_version" | "generated_at" | "id"
  >,
  current: Pick<
    ReportHistoryEntryRow,
    "report_kind" | "processing_version" | "emission_version" | "generated_at" | "id"
  >,
): boolean {
  if (candidate.report_kind === "annual" && candidate.processing_version !== current.processing_version) {
    return candidate.processing_version > current.processing_version;
  }
  if (candidate.emission_version !== current.emission_version) {
    return candidate.emission_version > current.emission_version;
  }
  if (candidate.generated_at !== current.generated_at) {
    return candidate.generated_at > current.generated_at;
  }
  return candidate.id > current.id;
}

/**
 * Mantém só a emissão mais recente de cada grupo do catálogo visível.
 * Bimestral: formulário + ano + bimestre. Anual: formulário + período, separado dos bimestres.
 */
export function selectLatestVisibleHistoryEntries<T extends ReportHistoryEntryRow>(rows: T[]): T[] {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const key = catalogHistoryGroupKey(row);
    const current = latest.get(key);
    if (!current || isCatalogRecencyGreater(row, current)) latest.set(key, row);
  }
  const ids = new Set([...latest.values()].map((row) => row.id));
  return rows.filter((row) => ids.has(row.id));
}
