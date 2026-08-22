import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mapConcurrent } from "@/shared/async/map-concurrent";
import { createRespondentUser } from "@/features/admin/users-service";
import { createOrganization } from "@/features/organizations/admin-service";
import type { Json } from "@/infrastructure/supabase/database.types";
import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";

export type ImportKind = "organizations" | "respondents";
export type ImportRowResult = {
  row: number;
  status: "valid" | "created" | "skipped" | "failed";
  identity: string;
  message: string;
};

export function respondentImportAccessMessage(delivery: {
  accessMethod: "email" | "recovery_link" | "temporary_password";
  recoveryLink: string | null;
}): string {
  if (delivery.accessMethod === "email") {
    return "Respondente criado e solicitação de definição de senha enviada ao provedor de e-mail.";
  }
  if (delivery.accessMethod === "recovery_link" && delivery.recoveryLink) {
    return "Respondente criado com link alternativo disponível. Gere e envie um novo link de definição de senha pela tela de usuários.";
  }
  return "Respondente criado com senha provisória.";
}

const IMPORT_JOB_KINDS = ["organization_import", "respondent_import"] as const;
type ImportJobKind = (typeof IMPORT_JOB_KINDS)[number];
const IMPORT_ITEMS_PER_RUN = 100;
const IMPORT_JOB_CONCURRENCY = 1;
const ORGANIZATION_CONCURRENCY = 5;
const RESPONDENT_CONCURRENCY = 3;

function delimiterOf(line: string): string {
  const candidates = [";", ",", "\t"];
  return candidates.reduce((best, current) =>
    line.split(current).length > line.split(best).length ? current : best,
  );
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      fields.push(field.trim());
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("O CSV possui um campo entre aspas sem fechamento.");
  fields.push(field.trim());
  return fields;
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseCsv(csv: string): Array<Record<string, string>> {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("O CSV precisa conter cabeçalho e ao menos uma linha de dados.");
  const delimiter = delimiterOf(lines[0]!);
  const headers = parseCsvLine(lines[0]!, delimiter).map(normalizeHeader);
  if (new Set(headers).size !== headers.length) throw new Error("O CSV possui cabeçalhos duplicados.");
  return lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line, delimiter);
    if (values.length > headers.length) {
      throw new Error(`A linha ${rowIndex + 2} possui mais colunas que o cabeçalho.`);
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]));
  });
}

function first(row: Record<string, string>, keys: string[]) {
  for (const key of keys) if (row[key]) return row[key]!;
  return "";
}

function validateOrganizationRows(rows: Array<Record<string, string>>): ImportRowResult[] {
  const seenNames = new Set<string>();
  const seenAcronyms = new Set<string>();
  return rows.map((row, index) => {
    const name = first(row, ["name", "nome", "organizacao", "orgao"]);
    const acronym = first(row, ["acronym", "sigla"]).toUpperCase();
    const identity = acronym || name || `Linha ${index + 2}`;
    if (name.length < 3 || name.length > 160) return { row: index + 2, status: "failed", identity, message: "O nome deve ter entre 3 e 160 caracteres." };
    if (!/^[A-Z0-9/]{2,12}$/.test(acronym)) return { row: index + 2, status: "failed", identity, message: "A sigla deve ter de 2 a 12 letras, números ou barra." };
    const nameKey = name.toLocaleLowerCase("pt-BR");
    const acronymKey = acronym.toLocaleLowerCase("pt-BR");
    if (seenNames.has(nameKey) || seenAcronyms.has(acronymKey)) {
      return { row: index + 2, status: "failed", identity, message: "Registro duplicado no próprio arquivo." };
    }
    seenNames.add(nameKey);
    seenAcronyms.add(acronymKey);
    return { row: index + 2, status: "valid", identity, message: "Registro válido." };
  });
}

function validateRespondentRows(rows: Array<Record<string, string>>): ImportRowResult[] {
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const email = first(row, ["email", "e_mail"]).toLocaleLowerCase("pt-BR");
    const acronym = first(row, ["organization_acronym", "sigla_organizacao", "sigla_org", "sigla"]).toUpperCase();
    const fullName = first(row, ["full_name", "nome", "nome_completo"]);
    const password = first(row, ["password", "senha_provisoria", "senha"]);
    const identity = email || `Linha ${index + 2}`;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { row: index + 2, status: "failed", identity, message: "E-mail inválido." };
    }
    if (!/^[A-Z0-9/]{2,12}$/.test(acronym)) return { row: index + 2, status: "failed", identity, message: "Informe uma sigla de organização válida." };
    if (fullName.length > 160) return { row: index + 2, status: "failed", identity, message: "O nome completo deve ter no máximo 160 caracteres." };
    if (password) return {
      row: index + 2,
      status: "failed",
      identity,
      message: "Não inclua senhas no CSV. O acesso inicial é enviado somente após a criação segura da conta.",
    };
    if (seen.has(email)) return { row: index + 2, status: "failed", identity, message: "E-mail duplicado no próprio arquivo." };
    seen.add(email);
    return { row: index + 2, status: "valid", identity, message: "Registro válido." };
  });
}

function isImportJobKind(kind: string): kind is ImportJobKind {
  return IMPORT_JOB_KINDS.some((candidate) => candidate === kind);
}

function inputRow(value: Json): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, typeof item === "string" ? item : String(item ?? "")]),
  );
}

function sanitizedOrganizationRow(row: Record<string, string>): Record<string, string> {
  return {
    name: first(row, ["name", "nome", "organizacao", "orgao"]),
    acronym: first(row, ["acronym", "sigla"]).toUpperCase(),
  };
}

function sanitizedRespondentRow(row: Record<string, string>): Record<string, string> {
  return {
    email: first(row, ["email", "e_mail"]).toLocaleLowerCase("pt-BR"),
    full_name: first(row, ["full_name", "nome", "nome_completo"]),
    organization_acronym: first(
      row,
      ["organization_acronym", "sigla_organizacao", "sigla_org", "sigla"],
    ).toUpperCase(),
  };
}

function sanitizedRows(kind: ImportKind, rows: Array<Record<string, string>>) {
  return rows.map((row) =>
    kind === "organizations" ? sanitizedOrganizationRow(row) : sanitizedRespondentRow(row),
  );
}

function importIdempotencyKey(kind: ImportJobKind, row: Record<string, string>): string {
  const identity = kind === "organization_import"
    ? `${row.acronym}:${row.name}`
    : `${row.email}:${row.organization_acronym}`;
  return createHash("sha256").update(`${kind}:${identity}`).digest("hex");
}

async function checkedUpdate(
  operation: PromiseLike<{ error: unknown }>,
): Promise<void> {
  const { error } = await operation;
  if (error) throw error;
}

export function previewCsvImport(kind: ImportKind, csv: string) {
  const rows = parseCsv(csv);
  if (rows.length > 2000) throw new Error("O arquivo aceita no máximo 2.000 linhas por lote.");
  const results = kind === "organizations" ? validateOrganizationRows(rows) : validateRespondentRows(rows);
  return {
    rows: sanitizedRows(kind, rows),
    results,
    validCount: results.filter((item) => item.status === "valid").length,
  };
}

export async function queueCsvImport(input: {
  kind: ImportKind;
  csv: string;
  actorUserId: string;
}) {
  const preview = previewCsvImport(input.kind, input.csv);
  if (preview.results.some((item) => item.status === "failed")) {
    throw new Error("Corrija as linhas inválidas antes de confirmar a importação.");
  }

  const client = createSupabaseServiceRoleClient();
  const kind = input.kind === "organizations" ? "organization_import" : "respondent_import";
  const { data: job, error: jobError } = await client
    .from("automation_jobs")
    .insert({
      kind,
      status: "pending",
      requested_by: input.actorUserId,
      scheduled_for: new Date().toISOString(),
      max_attempts: 100,
      payload: { row_count: preview.rows.length },
    })
    .select("id")
    .single();
  if (jobError || !job) throw jobError ?? new Error("Não foi possível enfileirar a importação.");
  const jobId = String(job.id);

  const { error: itemError } = await client.from("automation_job_items").insert(
    preview.rows.map((row, index) => ({
      job_id: jobId,
      entity_type: kind === "organization_import" ? "organization_import_row" : "respondent_import_row",
      entity_id: String(index + 2),
      idempotency_key: importIdempotencyKey(kind, row),
      status: "pending",
      input: row,
      output: { identity: preview.results[index]?.identity ?? `Linha ${index + 2}` },
    })),
  );
  if (itemError) {
    const { error: cleanupError } = await client.from("automation_jobs").delete().eq("id", jobId);
    if (cleanupError) {
      throw new Error(`import_queue_cleanup_failed:${cleanupError.message}`);
    }
    throw itemError;
  }

  return {
    jobId,
    status: "pending" as const,
    results: preview.results,
    total: preview.results.length,
    validCount: preview.validCount,
  };
}

async function organizationMap(
  client: TypedSupabaseClient,
  acronyms: string[],
): Promise<Map<string, string>> {
  const normalized = Array.from(
    new Set(acronyms.map((value) => value.trim().toUpperCase()).filter(Boolean)),
  );
  if (normalized.length === 0) return new Map();

  const { data, error } = await client
    .from("organizations")
    .select("id,acronym")
    .in("acronym", normalized);
  if (error) throw error;
  return new Map(
    (data ?? []).map((row) => [String(row.acronym).toUpperCase(), String(row.id)]),
  );
}

async function findExistingOrganization(
  client: TypedSupabaseClient,
  row: Record<string, string>,
) {
  const { data, error } = await client
    .from("organizations")
    .select("id,name,acronym,created_at")
    .eq("acronym", row.acronym)
    .maybeSingle();
  if (error) throw error;
  return data && String(data.name).toLocaleLowerCase("pt-BR") === row.name.toLocaleLowerCase("pt-BR")
    ? data
    : null;
}

async function findExistingRespondent(
  client: TypedSupabaseClient,
  email: string,
  organizationId: string,
) {
  const { data, error } = await client.rpc("list_admin_users_page", {
    p_search: email,
    p_organization_id: organizationId,
    p_role: "respondent",
    p_limit: 10,
    p_offset: 0,
  });
  if (error) throw error;
  return (data ?? []).find(
    (row) => row.email?.toLocaleLowerCase("pt-BR") === email.toLocaleLowerCase("pt-BR"),
  ) ?? null;
}

async function processImportItem(input: {
  client: TypedSupabaseClient;
  jobKind: ImportJobKind;
  actorUserId: string;
  item: { id: string; entity_id: string; input: Json };
  organizations: Map<string, string>;
}): Promise<void> {
  const row = inputRow(input.item.input);
  const rowNumber = Number(input.item.entity_id);
  await checkedUpdate(
    input.client.from("automation_job_items").update({ status: "processing" }).eq("id", input.item.id),
  );

  let result: ImportRowResult;
  let createdId: string | null = null;
  try {
    if (input.jobKind === "organization_import") {
      const name = row.name;
      const acronym = row.acronym;
      try {
        const created = await createOrganization({ name, acronym, actorUserId: input.actorUserId });
        createdId = created.id;
        result = { row: rowNumber, status: "created", identity: created.acronym, message: "Organização criada." };
      } catch (error) {
        const existing = await findExistingOrganization(input.client, row);
        if (!existing) throw error;
        createdId = existing.id;
        result = {
          row: rowNumber,
          status: "skipped",
          identity: existing.acronym,
          message: "A organização já estava cadastrada com os mesmos dados.",
        };
      }
    } else {
      const email = row.email;
      const fullName = row.full_name;
      const acronym = row.organization_acronym;
      const organizationId = input.organizations.get(acronym);
      if (!organizationId) throw new Error(`Organização com sigla ${acronym} não encontrada.`);
      try {
        const created = await createRespondentUser({
          email,
          fullName: fullName || null,
          organizationId,
          password: null,
          actorUserId: input.actorUserId,
        });
        createdId = created.userId;
        const accessMessage = respondentImportAccessMessage(created);
        result = { row: rowNumber, status: "created", identity: email, message: accessMessage };
      } catch (error) {
        const existing = await findExistingRespondent(input.client, email, organizationId);
        if (!existing) throw error;
        createdId = existing.user_id;
        result = {
          row: rowNumber,
          status: "skipped",
          identity: email,
          message: "O respondente já estava cadastrado nesta organização.",
        };
      }
    }
  } catch (caught) {
    result = {
      row: rowNumber,
      status: "failed",
      identity: input.jobKind === "organization_import" ? row.acronym || row.name : row.email,
      message: caught instanceof Error ? caught.message : "Falha não identificada.",
    };
  }

  await checkedUpdate(
    input.client
      .from("automation_job_items")
      .update({
        status: result.status === "created" ? "succeeded" : result.status,
        message: result.message,
        input: {},
        output: { identity: result.identity, created_id: createdId },
      })
      .eq("id", input.item.id),
  );
}

async function itemSummary(client: TypedSupabaseClient, jobId: string) {
  const { data, error } = await client
    .from("automation_job_items")
    .select("status")
    .eq("job_id", jobId);
  if (error) throw error;
  const statuses = (data ?? []).map((row) => String(row.status));
  return {
    total: statuses.length,
    pending: statuses.filter((status) => status === "pending" || status === "processing").length,
    succeeded: statuses.filter((status) => status === "succeeded").length,
    skipped: statuses.filter((status) => status === "skipped").length,
    failed: statuses.filter((status) => status === "failed").length,
  };
}

export async function processQueuedImports() {
  const client = createSupabaseServiceRoleClient();
  const workerId = `imports:${randomUUID()}`;
  const { data: jobs, error } = await client.rpc("claim_automation_jobs", {
    p_worker_id: workerId,
    p_kinds: [...IMPORT_JOB_KINDS],
    p_limit: 2,
    p_lock_timeout: "15 minutes",
  });
  if (error) throw error;

  return mapConcurrent(jobs ?? [], IMPORT_JOB_CONCURRENCY, async (job) => {
    const startedAtMs = Date.now();
    const jobId = String(job.id);
    try {
      if (!isImportJobKind(job.kind) || !job.requested_by) {
        throw new Error(
          "Job de importação inválido ou sem administrador responsável.",
        );
      }

      const jobKind: ImportJobKind = job.kind;
      const actorUserId = String(job.requested_by);
      const concurrency =
        jobKind === "respondent_import"
          ? RESPONDENT_CONCURRENCY
          : ORGANIZATION_CONCURRENCY;
      await checkedUpdate(
        client
          .from("automation_job_items")
          .update({ status: "pending" })
          .eq("job_id", jobId)
          .eq("status", "processing"),
      );

      const deadlineMs = startedAtMs + 4 * 60_000;
      let batches = 0;
      while (Date.now() < deadlineMs && batches < 10) {
        const { data: items, error: itemError } = await client
          .from("automation_job_items")
          .select("id,entity_id,input")
          .eq("job_id", jobId)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(IMPORT_ITEMS_PER_RUN);
        if (itemError) throw itemError;
        if (!items?.length) break;

        const organizations =
          jobKind === "respondent_import"
            ? await organizationMap(
                client,
                items.map((item) => inputRow(item.input).organization_acronym ?? ""),
              )
            : new Map<string, string>();

        await mapConcurrent(items, concurrency, async (item) =>
          processImportItem({
            client,
            jobKind,
            actorUserId,
            item: {
              id: String(item.id),
              entity_id: String(item.entity_id),
              input: item.input,
            },
            organizations,
          }),
        );
        batches += 1;
      }

      const summary = await itemSummary(client, jobId);
      const hasPending = summary.pending > 0;
      const status = hasPending
        ? "pending"
        : summary.failed === 0
          ? "completed"
          : summary.succeeded > 0 || summary.skipped > 0
            ? "completed_with_errors"
            : "failed";
      const { error: updateError } = await client
        .from("automation_jobs")
        .update({
          status,
          scheduled_for: hasPending
            ? new Date(Date.now() + 60_000).toISOString()
            : job.scheduled_for,
          completed_at: hasPending ? null : new Date().toISOString(),
          started_at: hasPending ? null : job.started_at,
          result_summary: summary,
          error_message:
            !hasPending && summary.failed === summary.total
              ? "Nenhuma linha pôde ser importada."
              : null,
          locked_at: null,
          locked_by: null,
          last_duration_ms: Date.now() - startedAtMs,
        })
        .eq("id", jobId);
      if (updateError) throw updateError;

      return { jobId, status, ...summary };
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Falha não identificada.";
      const exhausted = Number(job.attempts) >= Number(job.max_attempts);
      await checkedUpdate(
        client
          .from("automation_job_items")
          .update({
            status: exhausted ? "failed" : "pending",
            message: exhausted ? message : null,
            ...(exhausted ? { input: {} } : {}),
          })
          .eq("job_id", jobId)
          .in("status", ["pending", "processing"]),
      );
      const { error: updateError } = await client
        .from("automation_jobs")
        .update({
          status: exhausted ? "failed" : "pending",
          scheduled_for: exhausted
            ? job.scheduled_for
            : new Date(Date.now() + 5 * 60_000).toISOString(),
          completed_at: exhausted ? new Date().toISOString() : null,
          started_at: exhausted ? job.started_at : null,
          error_message: message,
          locked_at: null,
          locked_by: null,
          last_duration_ms: Date.now() - startedAtMs,
        })
        .eq("id", jobId);
      if (updateError) throw updateError;
      return {
        jobId,
        status: exhausted ? ("failed" as const) : ("pending" as const),
        message,
      };
    }
  });
}
