#!/usr/bin/env node
/**
 * Prévia da limpeza dos registros criados pelas jornadas automatizadas.
 * Não exclui formulário, ciclo, resposta, recomendação, plano ou usuário.
 */
import { createClient } from "@supabase/supabase-js";
import { prepareWritableEnvironment } from "../shared/writable-target.mjs";
import {
  assertAuthorizedHomologacaoProject,
  assertPreviewOnly,
  planE2eCleanup,
} from "./e2e-cleanup-plan.mjs";

try {
  assertPreviewOnly(process.argv.slice(2));
  process.env.ORIENTA_TARGET = "homologacao";
  const identity = prepareWritableEnvironment();
  assertAuthorizedHomologacaoProject(identity.projectRef);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const snapshot = await readSnapshot(supabase);
  const plan = planE2eCleanup(snapshot);
  console.log(JSON.stringify({ projeto: identity.projectRef, ...plan }, null, 2));
  if (plan.blockers.length > 0) process.exit(2);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function readSnapshot(supabase) {
  const forms = await rows(supabase, "forms", "id, name, current_form_version_id");
  const versions = await rows(supabase, "form_versions", "id, form_id");
  const cycles = await rows(
    supabase,
    "cycles",
    "id, state, period_label, form_version_id, organization_id, response_collection_paused_at",
  );
  const organizations = await rows(supabase, "organizations", "id, name");
  const axes = await rows(supabase, "axes", "name");
  const responses = await rows(supabase, "responses", "id, cycle_id");
  const recommendations = await rows(supabase, "recommendations", "id, cycle_id");
  const plans = await rows(supabase, "action_plans", "id, recommendation_id");
  const evidences = await rows(supabase, "evidences", "id, response_id, storage_path");
  const reports = await rows(supabase, "reports", "id, cycle_id, file_path");
  const documents = await rows(supabase, "action_plan_documents", "id, action_plan_id, storage_path");
  const progressUpdates = await rows(supabase, "action_plan_progress_updates", "id, action_plan_id");
  const pendingEvidence = await rows(supabase, "pending_evidence_uploads", "cycle_id, storage_path");
  const pendingDocuments = await rows(
    supabase,
    "pending_action_plan_document_uploads",
    "action_plan_id, storage_path",
  );
  const auditLogs = await rows(supabase, "audit_logs", "record_id, actor_user_id");
  const libraryAuditCount = await exactCount(supabase, "library_audit_events");
  const users = await userEmails(supabase);
  const formByVersion = new Map(versions.map((version) => [version.id, version.form_id]));
  const orgName = new Map(organizations.map((org) => [org.id, org.name]));
  const cycleByResponse = new Map(responses.map((row) => [row.id, row.cycle_id]));
  const cycleByRecommendation = new Map(recommendations.map((row) => [row.id, row.cycle_id]));
  const cycleByPlan = new Map(
    plans.map((row) => [row.id, cycleByRecommendation.get(row.recommendation_id) ?? ""]),
  );

  return {
    axes: axes.map((axis) => axis.name),
    organizations: organizations.map((org) => ({ name: org.name })),
    users,
    forms: forms.map((form) => ({
      id: form.id,
      name: form.name,
      published: Boolean(form.current_form_version_id),
    })),
    cycles: cycles.map((cycle) => ({
      id: cycle.id,
      formId: formByVersion.get(cycle.form_version_id) ?? "",
      state: cycle.state,
      periodLabel: cycle.period_label,
      organizationName: orgName.get(cycle.organization_id) ?? "",
      responseCollectionPausedAt: cycle.response_collection_paused_at,
    })),
    responses: responses.map((row) => ({ id: row.id, cycleId: row.cycle_id })),
    recommendations: recommendations.map((row) => ({ id: row.id, cycleId: row.cycle_id })),
    plans: plans.map((row) => ({ id: row.id, recommendationId: row.recommendation_id })),
    evidences: evidences.map((row) => ({
      storagePath: row.storage_path,
      cycleId: cycleByResponse.get(row.response_id) ?? "",
    })),
    reports: reports.map((row) => ({ filePath: row.file_path, cycleId: row.cycle_id })),
    actionPlanDocuments: documents.map((row) => ({
      planId: row.action_plan_id,
      storagePath: row.storage_path,
      cycleId: cycleByPlan.get(row.action_plan_id) ?? "",
    })),
    progressUpdates: progressUpdates.map((row) => ({
      planId: row.action_plan_id,
      cycleId: cycleByPlan.get(row.action_plan_id) ?? "",
    })),
    pendingEvidenceUploads: pendingEvidence.map((row) => ({
      storagePath: row.storage_path,
      cycleId: row.cycle_id,
    })),
    pendingActionPlanUploads: pendingDocuments.map((row) => ({
      storagePath: row.storage_path,
      cycleId: cycleByPlan.get(row.action_plan_id) ?? "",
    })),
    auditLogs: auditLogs.map((row) => ({
      recordId: row.record_id,
      actorUserId: row.actor_user_id,
    })),
    libraryAuditEvents: libraryAuditCount,
  };
}

async function rows(supabase, table, columns) {
  const pageSize = 1000;
  const collected = [];
  for (let from = 0; from <= 20000; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const batch = data ?? [];
    collected.push(...batch);
    if (batch.length < pageSize) return collected;
  }
  throw new Error(`${table}: leitura interrompida por volume inesperado.`);
}

async function exactCount(supabase, table) {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function userEmails(supabase) {
  const emails = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    emails.push(
      ...users
        .filter((user) => user.email)
        .map((user) => ({ id: user.id, email: user.email.toLowerCase() })),
    );
    if (users.length < 200) break;
  }
  return emails;
}
