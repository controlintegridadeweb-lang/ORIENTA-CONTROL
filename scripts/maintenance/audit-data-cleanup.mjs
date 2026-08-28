#!/usr/bin/env node
/**
 * Auditoria somente-leitura de pontos de limpeza de dados.
 * Usa credenciais de .env.local via service role.
 */
import { createServiceRoleSupabaseClient } from "../shared/create-service-role-supabase-client.mjs";
import { loadEnv, supabaseProjectRef } from "../shared/load-env.mjs";

loadEnv();

const supabase = createServiceRoleSupabaseClient();
const now = new Date().toISOString();
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

async function countWhere(table, apply) {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  q = apply(q);
  const { count, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function fetchAll(table, select, apply) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    let q = supabase.from(table).select(select).range(from, from + pageSize - 1);
    q = apply ? apply(q) : q;
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function sampleRows(table, select, apply, limit = 5) {
  let q = supabase.from(table).select(select).limit(limit);
  q = apply ? apply(q) : q;
  const { data, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

function section(title) {
  console.log(`\n## ${title}`);
}

function line(label, value, detail) {
  const suffix = detail ? ` — ${detail}` : "";
  console.log(`- ${label}: ${value}${suffix}`);
}

async function auditAssignmentsWithoutCycle() {
  const assignments = await fetchAll("form_assignments", "organization_id,form_id");
  const formVersions = await fetchAll("form_versions", "id,form_id");
  const formVersionToForm = new Map(formVersions.map((fv) => [fv.id, fv.form_id]));
  const cycles = await fetchAll("cycles", "organization_id,form_version_id");
  const cycleKeys = new Set(
    cycles
      .map((c) => {
        const formId = formVersionToForm.get(c.form_version_id);
        return formId ? `${c.organization_id}:${formId}` : null;
      })
      .filter(Boolean),
  );
  const missing = assignments.filter((a) => !cycleKeys.has(`${a.organization_id}:${a.form_id}`));
  return { total: assignments.length, missing: missing.length, samples: missing.slice(0, 5) };
}

async function auditProfileConsistency() {
  const profiles = await fetchAll("profiles", "user_id,role,organization_id");
  const invalid = profiles.filter((p) => {
    if (p.role === "admin") return p.organization_id !== null;
    if (p.role === "respondent") return !p.organization_id;
    return false;
  });
  return { total: profiles.length, invalid: invalid.length, samples: invalid.slice(0, 5) };
}

async function auditDeactivatedEvidencesWithStorage() {
  return countWhere("evidences", (q) =>
    q.not("deactivated_at", "is", null).not("storage_path", "is", null),
  );
}

async function auditDeactivatedActionPlanDocsWithStorage() {
  return countWhere("action_plan_documents", (q) =>
    q.not("deactivated_at", "is", null).not("storage_path", "is", null),
  );
}

async function auditCyclesWithoutResponses() {
  const cycles = await fetchAll("cycles", "id,state,organization_id");
  const responses = await fetchAll("responses", "cycle_id");
  const cyclesWithResponses = new Set(responses.map((r) => r.cycle_id));
  const empty = cycles.filter((c) => !cyclesWithResponses.has(c.id));
  return { count: empty.length, samples: empty.slice(0, 5) };
}

async function auditOperationalVolumes() {
  const [
    organizations,
    profiles,
    cycles,
    responses,
    evidences,
    reports,
    recommendations,
    actionPlans,
  ] = await Promise.all([
    countWhere("organizations", (q) => q),
    countWhere("profiles", (q) => q),
    countWhere("cycles", (q) => q),
    countWhere("responses", (q) => q),
    countWhere("evidences", (q) => q),
    countWhere("reports", (q) => q),
    countWhere("recommendations", (q) => q),
    countWhere("action_plans", (q) => q),
  ]);
  return {
    organizations,
    profiles,
    cycles,
    responses,
    evidences,
    reports,
    recommendations,
    actionPlans,
  };
}

async function main() {
  const projectRef = supabaseProjectRef();
  console.log(`# Auditoria de limpeza de dados — ORIENTA-CONTROL`);
  console.log(`Projeto: ${projectRef ?? "desconhecido"}`);
  console.log(`Executado em: ${now}`);

  section("Volumes gerais");
  try {
    const volumes = await auditOperationalVolumes();
    for (const [key, value] of Object.entries(volumes)) {
      line(key, value);
    }
  } catch (error) {
    line("ERRO volumes", error.message);
  }

  section("1. Uploads pendentes vencidos");
  try {
    const expiredEvidenceUploads = await countWhere("pending_evidence_uploads", (q) =>
      q.lt("expires_at", now),
    );
    const expiredPlanUploads = await countWhere("pending_action_plan_document_uploads", (q) =>
      q.lt("expires_at", now),
    );
    line("pending_evidence_uploads expirados", expiredEvidenceUploads, expiredEvidenceUploads > 0 ? "CRON pode estar falhando" : "OK");
    line("pending_action_plan_document_uploads expirados", expiredPlanUploads, expiredPlanUploads > 0 ? "CRON pode estar falhando" : "OK");
  } catch (error) {
    line("ERRO", error.message);
  }

  section("2. Filas de limpeza de Storage com atraso (>24h)");
  try {
    const delayedEvidenceQueue = await countWhere("evidence_storage_cleanup_queue", (q) =>
      q.lt("scheduled_for", oneDayAgo),
    );
    const delayedPlanQueue = await countWhere("action_plan_storage_cleanup_queue", (q) =>
      q.lt("scheduled_for", oneDayAgo),
    );
    const totalEvidenceQueue = await countWhere("evidence_storage_cleanup_queue", (q) => q);
    const totalPlanQueue = await countWhere("action_plan_storage_cleanup_queue", (q) => q);
    line("evidence_storage_cleanup_queue total", totalEvidenceQueue);
    line("evidence_storage_cleanup_queue atrasados", delayedEvidenceQueue, delayedEvidenceQueue > 0 ? "verificar cron/storage" : "OK");
    line("action_plan_storage_cleanup_queue total", totalPlanQueue);
    line("action_plan_storage_cleanup_queue atrasados", delayedPlanQueue, delayedPlanQueue > 0 ? "verificar cron/storage" : "OK");
  } catch (error) {
    line("ERRO", error.message);
  }

  section("3. Evidências/documentos desativados com storage_path");
  try {
    const deactivatedEvidences = await auditDeactivatedEvidencesWithStorage();
    const deactivatedDocs = await auditDeactivatedActionPlanDocsWithStorage();
    line("evidences desativadas com arquivo", deactivatedEvidences, deactivatedEvidences > 0 ? "verificar fila de cleanup" : "OK");
    line("action_plan_documents desativados com arquivo", deactivatedDocs, deactivatedDocs > 0 ? "verificar fila de cleanup" : "OK");
  } catch (error) {
    line("ERRO", error.message);
  }

  section("4. Falhas de emissão de relatório não resolvidas");
  try {
    const unresolved = await countWhere("report_emission_failures", (q) => q.is("resolved_at", null));
    line("report_emission_failures abertas", unresolved, unresolved > 0 ? "requer ação manual" : "OK");
    if (unresolved > 0) {
      const samples = await sampleRows(
        "report_emission_failures",
        "id,cycle_id,error_code,attempted_at",
        (q) => q.is("resolved_at", null).order("attempted_at", { ascending: false }),
        5,
      );
      for (const row of samples) {
        console.log(`  · ${row.id} cycle=${row.cycle_id} code=${row.error_code} at=${row.attempted_at}`);
      }
    }
  } catch (error) {
    line("ERRO", error.message);
  }

  section("5. Jobs de automação não terminais (>7 dias)");
  try {
    const terminal = ["completed", "completed_with_errors", "failed", "cancelled"];
    const stuck = (await fetchAll("automation_jobs", "id,status,kind,created_at,completed_at")).filter(
      (row) => !terminal.includes(row.status) && row.created_at < sevenDaysAgo,
    );
    line("automation_jobs presos", stuck.length, stuck.length > 0 ? "investigar worker" : "OK");
    for (const row of stuck.slice(0, 5)) {
      console.log(`  · ${row.id} status=${row.status} kind=${row.kind} created=${row.created_at}`);
    }
  } catch (error) {
    line("ERRO", error.message);
  }

  section("6. Rascunhos de validação abandonados (>30 dias, não aplicados)");
  try {
    const abandoned = await countWhere("validation_analysis_drafts", (q) =>
      q.is("applied_at", null).lt("created_at", thirtyDaysAgo),
    );
    line("validation_analysis_drafts abandonados", abandoned, abandoned > 0 ? "candidatos a limpeza" : "OK");
  } catch (error) {
    line("ERRO", error.message);
  }

  section("7. Assignments sem ciclo correspondente");
  try {
    const { total, missing, samples } = await auditAssignmentsWithoutCycle();
    line("form_assignments total", total);
    line("assignments sem ciclo", missing, missing > 0 ? "verificar cutover 2026" : "OK");
    for (const row of samples) {
      console.log(`  · org=${row.organization_id} form=${row.form_id}`);
    }
  } catch (error) {
    line("ERRO", error.message);
  }

  section("8. Perfis com inconsistência role/organization_id");
  try {
    const { total, invalid, samples } = await auditProfileConsistency();
    line("profiles total", total);
    line("profiles inconsistentes", invalid, invalid > 0 ? "corrigir antes de excluir órgãos" : "OK");
    for (const row of samples) {
      console.log(`  · user=${row.user_id} role=${row.role} org=${row.organization_id}`);
    }
  } catch (error) {
    line("ERRO", error.message);
  }

  section("9. Dados operacionais acumulados");
  try {
    const [
      rateLimits,
      oldJobs,
      oldOutbox,
      oldReadNotifications,
      unreadNotifications,
      deactivatedEvidences,
      cyclesWithoutResponses,
    ] = await Promise.all([
      countWhere("api_rate_limits", (q) => q.lt("expires_at", oneDayAgo)),
      countWhere("automation_jobs", (q) =>
        q.in("status", ["completed", "completed_with_errors", "failed", "cancelled"]).lt("completed_at", thirtyDaysAgo),
      ),
      countWhere("notification_outbox", (q) =>
        q.in("status", ["sent", "failed", "cancelled"]).lt("updated_at", thirtyDaysAgo),
      ),
      countWhere("user_notifications", (q) => q.not("read_at", "is", null).lt("read_at", thirtyDaysAgo)),
      countWhere("user_notifications", (q) => q.is("read_at", null)),
      countWhere("evidences", (q) => q.not("deactivated_at", "is", null)),
      auditCyclesWithoutResponses(),
    ]);
    line("api_rate_limits expirados (>1d)", rateLimits, rateLimits > 0 ? "cleanup_operational_data deveria remover" : "OK");
    line("automation_jobs terminais antigos (>30d)", oldJobs, oldJobs > 0 ? "cleanup_operational_data deveria remover" : "OK");
    line("notification_outbox antigas (>30d)", oldOutbox, oldOutbox > 0 ? "cleanup_operational_data deveria remover" : "OK");
    line("user_notifications lidas antigas (>30d, retenção real 180d)", oldReadNotifications);
    line("user_notifications não lidas", unreadNotifications);
    line("evidences desativadas (total)", deactivatedEvidences);
    line("ciclos sem respostas", cyclesWithoutResponses.count, cyclesWithoutResponses.count > 0 ? "revisar se são esperados" : "OK");
    for (const row of cyclesWithoutResponses.samples) {
      console.log(`  · cycle=${row.id} state=${row.state} org=${row.organization_id}`);
    }
  } catch (error) {
    line("ERRO", error.message);
  }

  section("10. Ciclos por estado");
  try {
    const cycles = await fetchAll("cycles", "id,state,organization_id");
    const byState = {};
    for (const c of cycles) {
      byState[c.state] = (byState[c.state] ?? 0) + 1;
    }
    for (const [state, count] of Object.entries(byState).sort()) {
      line(`cycles.state=${state}`, count);
    }
  } catch (error) {
    line("ERRO", error.message);
  }

  console.log("\n--- Fim da auditoria (somente leitura) ---");
}

main().catch((error) => {
  console.error("Falha na auditoria:", error.message);
  process.exit(1);
});
