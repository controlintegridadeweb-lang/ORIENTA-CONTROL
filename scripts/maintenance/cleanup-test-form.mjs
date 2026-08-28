#!/usr/bin/env node
/**
 * Remove formulário de teste e artefatos dependentes.
 *
 * Uso:
 *   node scripts/maintenance/cleanup-test-form.mjs --dry-run
 *   node scripts/maintenance/cleanup-test-form.mjs --execute --form-name teste
 */
import { createServiceRoleSupabaseClient } from "../shared/create-service-role-supabase-client.mjs";
import { loadEnv, supabaseProjectRef } from "../shared/load-env.mjs";

loadEnv();

const REPORTS_BUCKET = "relatorios";

function parseArgs(argv) {
  const args = {
    dryRun: false,
    execute: false,
    formName: "teste",
    formId: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") args.help = true;
    else if (token === "--dry-run") args.dryRun = true;
    else if (token === "--execute") args.execute = true;
    else if (token === "--form-name") args.formName = argv[++i] ?? "";
    else if (token === "--form-id") args.formId = argv[++i] ?? null;
    else throw new Error(`Opção desconhecida: ${token}`);
  }
  if (!args.help && !args.dryRun && !args.execute) args.dryRun = true;
  if (args.dryRun && args.execute) throw new Error("Use apenas --dry-run ou --execute.");
  return args;
}

function printHelp() {
  console.log(`
Uso:
  node scripts/maintenance/cleanup-test-form.mjs --dry-run [--form-name teste]
  node scripts/maintenance/cleanup-test-form.mjs --execute [--form-name teste]

Opções:
  --dry-run       Simula a limpeza (padrão)
  --execute       Executa a remoção (requer confirmação explícita no ambiente)
  --form-name     Nome exato do formulário (default: teste)
  --form-id       UUID do formulário (override)
  --help          Exibe esta ajuda
`);
}

async function fetchAll(supabase, table, select, apply) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select(select).range(from, from + 999);
    if (apply) q = apply(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function resolveGlobalAdminId(supabase) {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id,organization_id")
    .eq("role", "admin")
    .limit(2);
  if (error) throw error;
  if ((data ?? []).length !== 1 || data[0].organization_id !== null) {
    throw new Error("É necessário exatamente um administrador global sem organização.");
  }
  return data[0].user_id;
}

async function collectPlan(supabase, formId) {
  const form = await supabase.from("forms").select("*").eq("id", formId).maybeSingle();
  if (form.error) throw form.error;
  if (!form.data) throw new Error(`Formulário não encontrado: ${formId}`);

  const formVersions = await fetchAll(supabase, "form_versions", "*", (q) =>
    q.eq("form_id", formId),
  );
  const versionIds = formVersions.map((v) => v.id);

  const formDrafts = await fetchAll(supabase, "form_drafts", "*", (q) => q.eq("form_id", formId));
  const draftIds = formDrafts.map((d) => d.id);

  const formDraftQuestions =
    draftIds.length === 0
      ? []
      : await fetchAll(supabase, "form_draft_questions", "*", (q) =>
          q.in("form_draft_id", draftIds),
        );

  const formQuestions =
    versionIds.length === 0
      ? []
      : await fetchAll(supabase, "form_questions", "*", (q) =>
          q.in("form_version_id", versionIds),
        );

  const formPeriods =
    versionIds.length === 0
      ? []
      : await fetchAll(supabase, "form_periods", "*", (q) =>
          q.in("form_version_id", versionIds),
        );

  const assignments = await fetchAll(supabase, "form_assignments", "*", (q) =>
    q.eq("form_id", formId),
  );

  const cycles =
    versionIds.length === 0
      ? []
      : await fetchAll(supabase, "cycles", "*", (q) => q.in("form_version_id", versionIds));
  const cycleIds = cycles.map((c) => c.id);

  const responses =
    cycleIds.length === 0
      ? []
      : await fetchAll(supabase, "responses", "id,cycle_id", (q) => q.in("cycle_id", cycleIds));
  const responseIds = responses.map((r) => r.id);

  const evidences =
    responseIds.length === 0
      ? []
      : await fetchAll(supabase, "evidences", "id,response_id,kind,storage_path,external_link", (q) =>
          q.in("response_id", responseIds),
        );

  const recommendations =
    cycleIds.length === 0
      ? []
      : await fetchAll(supabase, "recommendations", "id,cycle_id", (q) => q.in("cycle_id", cycleIds));
  const recommendationIds = recommendations.map((r) => r.id);

  const actionPlans =
    recommendationIds.length === 0
      ? []
      : await fetchAll(supabase, "action_plans", "id,recommendation_id", (q) =>
          q.in("recommendation_id", recommendationIds),
        );
  const actionPlanIds = actionPlans.map((p) => p.id);

  const actionPlanDocuments =
    actionPlanIds.length === 0
      ? []
      : await fetchAll(supabase, "action_plan_documents", "id,action_plan_id,storage_path", (q) =>
          q.in("action_plan_id", actionPlanIds),
        );

  const reports =
    cycleIds.length === 0
      ? []
      : await fetchAll(supabase, "reports", "id,cycle_id,file_path,status", (q) =>
          q.in("cycle_id", cycleIds),
        );

  const reportFailures =
    cycleIds.length === 0
      ? []
      : await fetchAll(supabase, "report_emission_failures", "id,cycle_id,error_code", (q) =>
          q.in("cycle_id", cycleIds),
        );

  const cycleProcessings =
    cycleIds.length === 0
      ? []
      : await fetchAll(supabase, "cycle_processings", "id,cycle_id,status", (q) =>
          q.in("cycle_id", cycleIds),
        );
  const processingIds = cycleProcessings.map((p) => p.id);

  const famiResults =
    processingIds.length === 0
      ? []
      : await fetchAll(supabase, "fami_results", "id,cycle_processing_id", (q) =>
          q.in("cycle_processing_id", processingIds),
        );

  const responseSnapshots =
    processingIds.length === 0
      ? []
      : await fetchAll(supabase, "response_snapshots", "id,cycle_processing_id", (q) =>
          q.in("cycle_processing_id", processingIds),
        );

  const evidenceSnapshots =
    processingIds.length === 0
      ? []
      : await fetchAll(supabase, "evidence_snapshots", "id,cycle_processing_id", (q) =>
          q.in("cycle_processing_id", processingIds),
        );

  const pendingUploads =
    cycleIds.length === 0
      ? []
      : await fetchAll(supabase, "pending_evidence_uploads", "id,cycle_id,storage_path", (q) =>
          q.in("cycle_id", cycleIds),
        );

  const validationDrafts =
    cycleIds.length === 0
      ? []
      : await fetchAll(supabase, "validation_analysis_drafts", "id,cycle_id,applied_at", (q) =>
          q.in("cycle_id", cycleIds),
        );

  const automationItems =
    cycleIds.length === 0
      ? []
      : await fetchAll(supabase, "automation_job_items", "id,entity_id,entity_type,status", (q) =>
          q.in("entity_id", cycleIds),
        );

  const storagePaths = {
    reports: reports.map((r) => r.file_path).filter(Boolean),
    evidences: evidences.map((e) => e.storage_path).filter(Boolean),
    pendingUploads: pendingUploads.map((p) => p.storage_path).filter(Boolean),
    actionPlanDocuments: actionPlanDocuments.map((d) => d.storage_path).filter(Boolean),
  };

  return {
    form: form.data,
    formVersions,
    formDrafts,
    formDraftQuestions,
    formQuestions,
    formPeriods,
    assignments,
    cycles,
    responses,
    evidences,
    recommendations,
    actionPlans,
    actionPlanDocuments,
    reports,
    reportFailures,
    cycleProcessings,
    famiResults,
    responseSnapshots,
    evidenceSnapshots,
    pendingUploads,
    validationDrafts,
    automationItems,
    storagePaths,
  };
}

function summarizePlan(plan) {
  return [
    ["forms", 1],
    ["form_versions", plan.formVersions.length],
    ["form_drafts", plan.formDrafts.length],
    ["form_draft_questions", plan.formDraftQuestions.length],
    ["form_questions", plan.formQuestions.length],
    ["form_periods", plan.formPeriods.length],
    ["form_assignments", plan.assignments.length],
    ["cycles", plan.cycles.length],
    ["responses", plan.responses.length],
    ["evidences", plan.evidences.length],
    ["recommendations", plan.recommendations.length],
    ["action_plans", plan.actionPlans.length],
    ["action_plan_documents", plan.actionPlanDocuments.length],
    ["reports", plan.reports.length],
    ["report_emission_failures", plan.reportFailures.length],
    ["cycle_processings", plan.cycleProcessings.length],
    ["fami_results", plan.famiResults.length],
    ["response_snapshots", plan.responseSnapshots.length],
    ["evidence_snapshots", plan.evidenceSnapshots.length],
    ["pending_evidence_uploads", plan.pendingUploads.length],
    ["validation_analysis_drafts", plan.validationDrafts.length],
    ["automation_job_items (por cycle_id)", plan.automationItems.length],
    ["storage: relatorios", plan.storagePaths.reports.length],
    ["storage: evidencias", plan.storagePaths.evidences.length],
    ["storage: uploads pendentes", plan.storagePaths.pendingUploads.length],
    ["storage: planos-acao", plan.storagePaths.actionPlanDocuments.length],
  ];
}

function printPlan(plan, mode) {
  console.log(`\n# Limpeza do formulário "${plan.form.name}" (${plan.form.id})`);
  console.log(`Modo: ${mode}`);
  console.log(`Criado em: ${plan.form.created_at}`);

  if (plan.assignments.length) {
    console.log("\n## Assignments");
    for (const row of plan.assignments) {
      console.log(`- org=${row.organization_id} assigned_at=${row.assigned_at}`);
    }
  }

  if (plan.cycles.length) {
    console.log("\n## Ciclos");
    for (const row of plan.cycles) {
      console.log(`- ${row.id} state=${row.state} period=${row.period_label}`);
    }
  }

  console.log("\n## Contagens a remover");
  for (const [label, count] of summarizePlan(plan)) {
    if (count > 0) console.log(`- ${label}: ${count}`);
  }

  const totalRows = summarizePlan(plan)
    .slice(1)
    .reduce((sum, [, count]) => sum + count, 1);
  console.log(`\nTotal estimado de registros de banco: ${totalRows}`);

  if (plan.storagePaths.reports.length) {
    console.log("\n## Arquivos no Storage (relatorios)");
    for (const path of plan.storagePaths.reports) console.log(`- ${path}`);
  }

  console.log("\n## Ordem de execução (--execute)");
  console.log("1. Remover PDFs do bucket relatorios");
  console.log("2. report_emission_failures → reports");
  console.log("3. cycles (CASCADE: responses, evidences, recommendations, processings, etc.)");
  console.log("4. form_assignments → form_periods → form_questions");
  console.log("5. form_draft_questions → form_drafts → form_versions → forms");
  console.log("6. Remover perguntas órfãs do rascunho, se existirem");
}

async function verifyStorageObjects(supabase, bucket, paths) {
  const found = [];
  for (const path of paths) {
    const { data, error } = await supabase.storage.from(bucket).list(path.split("/").slice(0, -1).join("/") || undefined, {
      search: path.split("/").pop(),
    });
    if (error) {
      found.push({ path, status: `erro: ${error.message}` });
      continue;
    }
    const exists = (data ?? []).some((item) => `${path.split("/").slice(0, -1).join("/")}/${item.name}`.endsWith(path.split("/").pop()) || item.name === path.split("/").pop());
    found.push({ path, status: exists ? "presente" : "não encontrado (pode já ter sido removido)" });
  }
  return found;
}

function sqlUuid(value) {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error(`UUID inválido: ${value}`);
  return `'${value}'`;
}

function sqlString(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function runManagementSql(query) {
  const ref = supabaseProjectRef();
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!ref || !token) {
    throw new Error("SUPABASE_ACCESS_TOKEN e NEXT_PUBLIC_SUPABASE_URL são necessários para --execute.");
  }
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Management API HTTP ${response.status}: ${body}`);
  return body;
}

function buildCleanupSql(plan, adminUserId) {
  const formId = plan.form.id;
  const cycleIds = plan.cycles.map((c) => c.id);
  const versionIds = plan.formVersions.map((v) => v.id);
  const draftIds = plan.formDrafts.map((d) => d.id);
  const orphanQuestionIds = [
    ...new Set(plan.formDraftQuestions.map((q) => q.question_id).filter(Boolean)),
  ];
  const reportPaths = plan.storagePaths.reports;

  const statements = [
    "begin",
    "set local session_replication_role = replica",
  ];

  if (cycleIds.length) {
    statements.push(
      `delete from public.report_emission_failures where cycle_id in (${cycleIds.map(sqlUuid).join(", ")})`,
      `delete from public.reports where cycle_id in (${cycleIds.map(sqlUuid).join(", ")})`,
    );
  }

  if (reportPaths.length) {
    statements.push("select set_config('storage.allow_delete_query', 'true', true)");
    statements.push(
      `delete from storage.objects where bucket_id = 'relatorios' and name in (${reportPaths.map(sqlString).join(", ")})`,
    );
    statements.push("select set_config('storage.allow_delete_query', 'false', true)");
  }

  for (const cycleId of cycleIds) {
    statements.push(
      `delete from public.action_plan_documents where action_plan_id in (
         select ap.id from public.action_plans ap
         join public.recommendations r on r.id = ap.recommendation_id
         where r.cycle_id = ${sqlUuid(cycleId)}
       )`,
      `delete from public.action_plan_progress_updates where action_plan_id in (
         select ap.id from public.action_plans ap
         join public.recommendations r on r.id = ap.recommendation_id
         where r.cycle_id = ${sqlUuid(cycleId)}
       )`,
      `delete from public.action_plans where recommendation_id in (
         select id from public.recommendations where cycle_id = ${sqlUuid(cycleId)}
       )`,
      `delete from public.recommendations where cycle_id = ${sqlUuid(cycleId)}`,
      `delete from public.evidences where response_id in (
         select id from public.responses where cycle_id = ${sqlUuid(cycleId)}
       )`,
      `delete from public.responses where cycle_id = ${sqlUuid(cycleId)}`,
      `delete from public.fami_results where cycle_id = ${sqlUuid(cycleId)}`,
      `delete from public.response_snapshots where cycle_processing_id in (
         select id from public.cycle_processings where cycle_id = ${sqlUuid(cycleId)}
       )`,
      `delete from public.evidence_snapshots where cycle_processing_id in (
         select id from public.cycle_processings where cycle_id = ${sqlUuid(cycleId)}
       )`,
      `delete from public.cycle_processings where cycle_id = ${sqlUuid(cycleId)}`,
      `delete from public.automation_job_items where entity_id = ${sqlUuid(cycleId)}`,
      `delete from public.validation_analysis_drafts where cycle_id = ${sqlUuid(cycleId)}`,
    );
  }

  if (cycleIds.length) {
    statements.push(`delete from public.cycles where id in (${cycleIds.map(sqlUuid).join(", ")})`);
  }

  statements.push(`delete from public.form_assignments where form_id = ${sqlUuid(formId)}`);

  if (plan.formPeriods.length) {
    statements.push(
      `delete from public.form_periods where id in (${plan.formPeriods.map((p) => sqlUuid(p.id)).join(", ")})`,
    );
  }

  if (versionIds.length) {
    statements.push(
      `delete from public.form_questions where form_version_id in (${versionIds.map(sqlUuid).join(", ")})`,
    );
  }

  if (draftIds.length) {
    statements.push(
      `delete from public.form_draft_questions where form_draft_id in (${draftIds.map(sqlUuid).join(", ")})`,
    );
    statements.push(`delete from public.form_drafts where form_id = ${sqlUuid(formId)}`);
  }

  if (versionIds.length) {
    statements.push(`delete from public.form_versions where form_id = ${sqlUuid(formId)}`);
  }

  if (orphanQuestionIds.length) {
    statements.push(
      `delete from public.question_versions where question_id in (${orphanQuestionIds.map(sqlUuid).join(", ")})`,
    );
    statements.push(
      `delete from public.questions where id in (${orphanQuestionIds.map(sqlUuid).join(", ")})`,
    );
  }

  statements.push(`delete from public.forms where id = ${sqlUuid(formId)}`);
  statements.push("set local session_replication_role = default");
  statements.push(
    `insert into public.audit_logs (actor_user_id, event_type, entity_type, record_id, before_json, after_json)
     values (${sqlUuid(adminUserId)}, 'maintenance.test_form_cleanup', 'forms', ${sqlUuid(formId)},
             ${sqlString(JSON.stringify({ formName: plan.form.name, cycleIds }))}::jsonb,
             '{"removed": true}'::jsonb)`,
  );
  statements.push("commit");

  return `${statements.join(";\n")};`;
}

async function executeCleanup(plan, adminUserId) {
  const sql = buildCleanupSql(plan, adminUserId);
  await runManagementSql(sql);
  return { formId: plan.form.id, cycleIds: plan.cycles.map((c) => c.id) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const supabase = createServiceRoleSupabaseClient();

  let formId = args.formId;
  if (!formId) {
    const { data, error } = await supabase.from("forms").select("id,name").eq("name", args.formName);
    if (error) throw error;
    if ((data ?? []).length === 0) throw new Error(`Nenhum formulário com nome "${args.formName}".`);
    if (data.length > 1) throw new Error(`Múltiplos formulários com nome "${args.formName}". Use --form-id.`);
    formId = data[0].id;
  }

  const plan = await collectPlan(supabase, formId);
  printPlan(plan, args.dryRun ? "DRY-RUN (nenhuma mutação)" : "EXECUTE");

  if (plan.storagePaths.reports.length) {
    console.log("\n## Verificação Storage (somente leitura)");
    const storageCheck = await verifyStorageObjects(supabase, REPORTS_BUCKET, plan.storagePaths.reports);
    for (const item of storageCheck) console.log(`- ${item.path}: ${item.status}`);
  }

  if (args.dryRun) {
    console.log("\n✓ Dry-run concluído. Nenhum dado foi alterado.");
    console.log("  Para executar: node scripts/maintenance/cleanup-test-form.mjs --execute");
    return;
  }

  const adminUserId = await resolveGlobalAdminId(supabase);
  const result = await executeCleanup(plan, adminUserId);
  console.log("\n✓ Limpeza executada:", result);
}

main().catch((error) => {
  console.error("Falha:", error.message);
  process.exit(1);
});
