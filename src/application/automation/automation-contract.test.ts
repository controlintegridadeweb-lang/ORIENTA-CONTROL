import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs
  .readdirSync(path.join(process.cwd(), "supabase", "migrations"))
  .filter((name) => /^\d{14}_.+\.sql$/.test(name))
  .sort()
  .map((name) =>
    fs.readFileSync(path.join(process.cwd(), "supabase", "migrations", name), "utf8"),
  )
  .join("\n");
const scheduledCycleService = fs.readFileSync(
  path.join(process.cwd(), "src", "application", "automation", "scheduled-cycle-service.ts"),
  "utf8",
);
const cycleJobsRoute = fs.readFileSync(
  path.join(process.cwd(), "src", "app", "api", "maintenance", "cycle-jobs", "route.ts"),
  "utf8",
);
const cycleBatchRoute = fs.readFileSync(
  path.join(process.cwd(), "src", "app", "api", "admin", "cycles", "batch", "route.ts"),
  "utf8",
);
const createCronRoute = fs.readFileSync(
  path.join(process.cwd(), "src", "application", "automation", "create-cron-route.ts"),
  "utf8",
);
const cronAuthorization = fs.readFileSync(
  path.join(process.cwd(), "src", "application", "automation", "cron-authorization.ts"),
  "utf8",
);
const navigation = fs.readFileSync(
  path.join(process.cwd(), "src", "shared", "ui", "navigation.ts"),
  "utf8",
);
const databaseTypes = fs.readFileSync(
  path.join(process.cwd(), "src", "infrastructure", "supabase", "database.types.ts"),
  "utf8",
);
const vercelConfiguration = fs.readFileSync(
  path.join(process.cwd(), "vercel.json"),
  "utf8",
);
const evidenceUploadRoute = fs.readFileSync(
  path.join(process.cwd(), "src", "app", "api", "workbench", "evidence", "upload", "route.ts"),
  "utf8",
);
const evidenceDownloadRoute = fs.readFileSync(
  path.join(process.cwd(), "src", "app", "api", "evidences", "[evidenceId]", "file", "route.ts"),
  "utf8",
);
const verifyEvidenceUpload = fs.readFileSync(
  path.join(process.cwd(), "src", "application", "workbench-evidence-upload", "verify-evidence-upload.ts"),
  "utf8",
);

describe("contrato das operações programadas", () => {
  it("não cria entidade, participantes ou máquina de estados paralela", () => {
    expect(migration).not.toContain("create table public.diagnostic_campaigns");
    expect(migration).not.toContain("diagnostic_campaign_organizations");
    expect(migration).not.toContain("campaign_id uuid");
    expect(migration).toContain("create table public.automation_job_items");
    expect(migration).toContain("entity_type=cycle referencia public.cycles");
    expect(databaseTypes).toContain("automation_job_items: {");
    expect(databaseTypes).toContain("automation_jobs: {");
    expect(databaseTypes).toContain("notification_outbox: {");
    expect(databaseTypes).toContain("user_notifications: {");
  });

  it("mantém form_assignments como única fonte de organizações elegíveis", () => {
    expect(migration).not.toContain("form_assignment_policies");
    expect(migration).not.toContain("include_future_organizations");
    expect(navigation).not.toContain('/admin/campanhas');
  });

  it("mantém autoria, executor sistêmico e decisões humanas", () => {
    expect(migration).toContain("executed_by_system boolean not null default false");
    expect(migration).toContain("requested_by uuid references auth.users(id)");
    expect(migration).toContain("dispatch_evidence_adjustments");
    expect(migration).toContain("validation_resubmitted");
    expect(migration).not.toContain("auto_approve_evidence");
  });

  it("agenda diretamente os diagnósticos e reprocessa apenas itens não resolvidos", () => {
    expect(migration).toContain("create or replace function public.replace_cycle_schedule");
    expect(migration).toContain("'cycle_open', 'pending'");
    expect(migration).toContain("'validation_finalize', 'pending'");
    expect(migration).toContain("'cycle_close', 'pending'");
    expect(migration).toContain("'reminder_dispatch', 'pending'");
    expect(migration).toContain("v_summary := public.replace_cycle_schedule");
    expect(scheduledCycleService).toContain('.from("automation_job_items")');
    expect(scheduledCycleService).toContain('.eq("status", "pending")');
    expect(scheduledCycleService).toContain("targetReached");
    expect(scheduledCycleService).toContain("waitsForBusinessCondition");
    expect(scheduledCycleService).toContain(
      'attempts: waitsForBusinessCondition ? 0 : job.attempts',
    );
    expect(scheduledCycleService).toContain(
      '.in("status", ["failed", "processing", "pending"])',
    );
    expect(scheduledCycleService).not.toContain("ensureScheduledJob");
    expect(scheduledCycleService).not.toContain("campaignId");
    expect(scheduledCycleService).not.toContain("as unknown as SupabaseClient");
  });

  it("confirma criação e programação do lote na mesma transação", () => {
    expect(migration).toContain("create or replace function public.process_cycles_batch_with_reference");
    expect(migration).toContain("from public.prepare_cycle_schedule_registration");
    expect(migration).toContain("app.defer_cycle_schedule_materialization");
    expect(migration).toContain("if not v_defer_schedule then");
    expect(migration).toContain("create or replace function public.cancel_cycle_schedule_jobs");
    expect(migration).toContain("v_cancelled_items := public.cancel_cycle_schedule_jobs");
    expect(cycleBatchRoute).toContain("create-cycles-batch-route");
    const cycleBatchHandler = fs.readFileSync(
      path.join(process.cwd(), "src", "features", "cycles", "http", "create-cycles-batch-route.ts"),
      "utf8",
    );
    expect(cycleBatchHandler).toContain("processCyclesForOrganizations");
    expect(cycleBatchHandler).not.toContain("registerCycleSchedules");
    expect(databaseTypes).toContain("process_cycles_batch_with_reference: {");
  });

  it("substitui o cronograma completo de forma transacional e versionada", () => {
    expect(migration).toContain(
      "create or replace function public.update_cycle_schedule(",
    );
    expect(migration).toContain("p_validation_deadline_at timestamptz");
    expect(migration).toContain("p_cycle_close_at timestamptz");
    expect(migration).toContain("schedule_revision = schedule_revision + 1");
    expect(migration).toContain("validation_deadline_at = p_validation_deadline_at");
    expect(migration).toContain("cycle_close_at = p_cycle_close_at");
    expect(migration).toContain("Programação obsoleta");
    expect(migration).toContain(`returns table (
  cycle_id uuid,
  schedule_revision bigint,
  jobs_created integer`);
    expect(databaseTypes).toContain("jobs_created: number");
    expect(databaseTypes).toContain("reminders_created: number");
  });

  it("exige validação estrutural antes de liberar arquivos de evidência", () => {
    expect(migration).toContain("file_evidence_requires_structural_validation");
    expect(migration).toContain("file_validation_status");
    expect(migration).toContain("file_validated_at");
    expect(migration).not.toContain("claim_evidence_malware_scans");
    expect(evidenceUploadRoute).toContain("verifyEvidenceUpload");
    expect(verifyEvidenceUpload).toContain("verifyStoredEvidenceFile");
    expect(verifyEvidenceUpload).toContain("file_validation_status");
    expect(verifyEvidenceUpload).toContain("markPendingEvidenceUploadVerified");
    expect(verifyEvidenceUpload).not.toContain("scanEvidenceUrlWithClamAv");
    expect(evidenceDownloadRoute).toContain('file_validation_status !== "valid"');
    expect(evidenceDownloadRoute).not.toContain("malware_scan_status");
    expect(vercelConfiguration).not.toContain("/api/maintenance/evidence-malware-scan");
  });

  it("não permite persistir credenciais ou links de recuperação nos itens da fila", () => {
    expect(migration).toContain("automation_job_items_no_sensitive_input");
    expect(migration).toContain("automation_job_items_no_sensitive_output");
    expect(migration).toContain("'senha_provisoria'");
    expect(migration).toContain("'recovery_link'");
    expect(migration).toContain("create or replace function public.cleanup_operational_data");
  });

  it("separa workers sem perder a proteção compartilhada do cron", () => {
    expect(cycleJobsRoute).toContain("processDueCycleAutomations");
    expect(cycleJobsRoute).toContain("createCronRoute");
    expect(createCronRoute).toContain("authorizeCron");
    expect(cronAuthorization).toContain("process.env.CRON_SECRET");
    expect(vercelConfiguration).toContain('/api/maintenance/cycle-jobs');
    expect(vercelConfiguration).toContain('/api/maintenance/imports');
    expect(vercelConfiguration).toContain('/api/maintenance/report-bundles');
    expect(vercelConfiguration).toContain('/api/maintenance/notifications/dispatch');
    expect(vercelConfiguration).toContain('/api/maintenance/fami-preliminary-close');
    expect(vercelConfiguration).toContain('"schedule": "0 3 * * *"');
    expect(vercelConfiguration).not.toContain('/api/maintenance/automations');
  });

  it("recupera locks vencidos mesmo quando a última tentativa ficou sem desfecho", () => {
    expect(migration).toContain(
      "j.status = 'processing' and j.locked_at < now() - p_lock_timeout",
    );
    expect(migration).toContain(
      "o.status = 'processing' and o.locked_at < now() - p_lock_timeout",
    );
    expect(migration).toContain(
      "attempts = least(j.attempts + 1, j.max_attempts)",
    );
    expect(migration).toContain(
      "attempts = least(o.attempts + 1, o.max_attempts)",
    );
    expect(migration).not.toContain(
      "where j.attempts < j.max_attempts",
    );
    expect(migration).not.toContain(
      "where o.attempts < o.max_attempts",
    );
  });

  it("atualiza avisos operacionais na leitura in-app sem depender só do cron", () => {
    const notificationsRoute = fs.readFileSync(
      path.join(process.cwd(), "src", "app", "api", "notifications", "route.ts"),
      "utf8",
    );
    const dispatchService = fs.readFileSync(
      path.join(process.cwd(), "src", "application", "automation", "notification-dispatch-service.ts"),
      "utf8",
    );
    expect(notificationsRoute).toContain("refreshOperationalNotificationsForRead");
    expect(notificationsRoute).toContain("after(() => refreshOperationalNotificationsForRead())");
    expect(notificationsRoute).not.toContain("await refreshOperationalNotificationsForRead()");
    expect(dispatchService).toContain("refreshOperationalNotificationsForRead");
    expect(dispatchService).toContain("notifications-enqueue-on-read");
    expect(dispatchService).not.toContain("processDueCycleAutomations");
    expect(dispatchService).toContain("cancelUndeliverableExternalNotifications");
  });

  it("notifica o respondente na abertura, início, conclusão e encerramento do diagnóstico", () => {
    expect(migration).toContain("notify_cycle_lifecycle");
    expect(migration).toContain("diagnostic_opened");
    expect(migration).toContain("diagnostic_validation_started");
    expect(migration).toContain("diagnostic_validated");
    expect(migration).not.toContain("evidence_invalidated");
    expect(migration).toContain("diagnostic_completed");
    expect(migration).toContain("official_report_available");
    expect(migration).toContain("notify_organization_respondents");
    expect(migration).toContain("notify_administrators");
    expect(migration).toContain("validation_resubmitted");
    expect(migration).toContain("action_plans_notify_admin");
    expect(migration).toContain("action_plan_supervision_notes_notify_respondents");
    expect(migration).toContain("action_plan_supervision_accepted");
    expect(migration).not.toContain("validation-pending:%s:user:%s");
    expect(migration).toContain("'proof_request_count', v_proof_request_count");
    expect(migration).toContain("'total_count', v_total_count");
    expect(migration).toContain("un.kind = 'validation_pending'");
    expect(migration).toContain(
      "old.state = 'submitted'::public.cycle_state",
    );
  });

  it("notifica respondente criado após a abertura sobre ciclos já em resposta", () => {
    expect(migration).toContain("notify_respondent_open_cycles");
    expect(migration).toContain("profiles_notify_open_cycles");
    expect(migration).toContain("notify_respondent_user");
    expect(migration).toContain("source', 'respondent_org_link'");
    expect(migration).toContain("diagnostic-opened:%s:reopen:%s");
  });
});
