#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServiceRoleSupabaseClient } from "../shared/create-service-role-supabase-client.mjs";
import {
  buildImportedResponseNotes,
  evidencePayload,
  expectedEvidenceValidationStatus,
  loadDiagnosticImportManifest,
  normalizeComparableText,
  responseEvidenceUrls,
} from "./lib/diagnostic-response-import.mjs";
import { parseRespondentSeed } from "./lib/respondent-seed.mjs";
import {
  DIAGNOSTIC_RESPONSE_SOURCE_NAME,
  loadCycleResponses,
  verifyImportedRecord,
} from "./lib/diagnostic-response-storage.mjs";

function printHelp() {
  console.log(`
Uso:
  npm run import:diagnostic-responses -- [opções]

Opções:
  --file <json>             Manifesto normalizado mantido fora do Git
  --accounts-file <csv>     Contas operacionais mantidas fora do Git
  --dry-run                  Valida banco, usuários, formulário e mapeamentos sem gravar
  --verify-only           Confere se perfis, ciclos e respostas já foram importados
  --no-publish          Não publica automaticamente o formulário oficial se ainda estiver em rascunho
  --finalize            Finaliza ciclos após pareceres históricos; Sim sem comprovação
                        recebe validate_without_proof (carga histórica, sem fila admin)
  --help                Exibe esta ajuda

Pré-requisitos:
  1. migrations aplicadas;
  2. administrador global criado;
  3. 42 respondentes provisionados a partir do mesmo --accounts-file;
  4. formulário oficial criado e publicado pelo fluxo administrativo;
  5. manifesto e contas operacionais armazenados fora do repositório.
`);
}

function parseArgs(argv) {
  const args = {
    file: null,
    accountsFile: null,
    dryRun: false,
    verifyOnly: false,
    publishIfNeeded: true,
    finalize: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--file") {
      const path = argv[index + 1];
      if (!path || path.startsWith("--")) throw new Error("--file exige um caminho.");
      args.file = resolve(path);
      index += 1;
    } else if (value === "--accounts-file") {
      const path = argv[index + 1];
      if (!path || path.startsWith("--")) throw new Error("--accounts-file exige um caminho.");
      args.accountsFile = resolve(path);
      index += 1;
    } else if (value === "--dry-run") args.dryRun = true;
    else if (value === "--verify-only") {
      args.verifyOnly = true;
      args.dryRun = true;
    } else if (value === "--no-publish") args.publishIfNeeded = false;
    else if (value === "--finalize") args.finalize = true;
    else if (value === "--help" || value === "-h") args.help = true;
    else throw new Error(`Opção desconhecida: ${value}`);
  }
  if (args.verifyOnly && args.finalize) {
    throw new Error("--verify-only não pode ser combinado com --finalize.");
  }
  if (!args.help && (!args.file || !args.accountsFile)) {
    throw new Error("Informe --file e --accounts-file. Dados operacionais não são versionados.");
  }
  return args;
}

function unwrapRelation(value) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
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

async function loadOrganizationsAndRespondents(supabase, manifest, accounts) {
  const { data: organizations, error: organizationError } = await supabase
    .from("organizations")
    .select("id,name,acronym");
  if (organizationError) throw organizationError;
  const organizationByAcronym = new Map(
    (organizations ?? []).map((organization) => [organization.acronym.toUpperCase(), organization]),
  );

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("user_id,organization_id,full_name")
    .eq("role", "respondent");
  if (profileError) throw profileError;
  const respondentsByOrganization = new Map();
  for (const profile of profiles ?? []) {
    const current = respondentsByOrganization.get(profile.organization_id) ?? [];
    current.push(profile);
    respondentsByOrganization.set(profile.organization_id, current);
  }

  const seedTargets = new Map();
  for (const account of accounts) {
    const organization = organizationByAcronym.get(account.organizationAcronym.toUpperCase());
    if (!organization) throw new Error(`Organização ${account.organizationAcronym} não cadastrada.`);
    const profilesForOrganization = respondentsByOrganization.get(organization.id) ?? [];
    if (profilesForOrganization.length !== 1) {
      throw new Error(
        `${account.organizationAcronym}: esperado exatamente um respondente; encontrados ${profilesForOrganization.length}.`,
      );
    }
    seedTargets.set(account.organizationAcronym, {
      organization,
      profile: profilesForOrganization[0],
    });
  }

  const targets = new Map();
  for (const record of manifest.records) {
    const target = seedTargets.get(record.organization_acronym);
    if (!target) throw new Error(`${record.organization_acronym}: órgão não consta no seed oficial.`);
    targets.set(record.organization_acronym, target);
  }

  return {
    targets,
    allOrganizationIds: [...seedTargets.values()].map((target) => target.organization.id),
  };
}

async function loadForm(supabase, formName) {
  const { data, error } = await supabase
    .from("forms")
    .select("id,name,current_form_version_id")
    .eq("name", formName)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Formulário "${formName}" não encontrado. Crie e publique o formulário oficial antes da importação.`);
  return data;
}

async function syncAssignments(supabase, formId, organizationIds, actorUserId, dryRun) {
  const desired = [...new Set(organizationIds)];
  if (!dryRun) {
    const { error: syncError } = await supabase.rpc("sync_form_assignments", {
      p_form_id: formId,
      p_organization_ids: desired,
      p_actor_user_id: actorUserId,
    });
    if (syncError) throw syncError;
  }
  return desired;
}

async function ensurePublishedForm(supabase, form, actorUserId, args) {
  if (form.current_form_version_id) return form;
  if (!args.publishIfNeeded) {
    throw new Error("O formulário oficial ainda não foi publicado e --no-publish foi informado.");
  }
  if (args.dryRun) return { ...form, current_form_version_id: "dry-run:published-version" };
  const { data, error } = await supabase.rpc("publish_form", {
    p_form_id: form.id,
    p_actor_user_id: actorUserId,
  });
  if (error) throw error;
  return { ...form, current_form_version_id: data.id };
}

async function loadPublishedQuestions(supabase, formVersionId, manifest) {
  if (formVersionId.startsWith("dry-run:")) {
    return manifest.questions.map((question) => ({
      orderIndex: question.source_order - 1,
      questionVersionId: `dry-run:qv:${question.source_order}`,
      questionId: `dry-run:q:${question.source_order}`,
      prompt: question.prompt,
      requiresEvidence: question.requires_evidence,
    }));
  }
  const { data, error } = await supabase
    .from("form_questions")
    .select("order_index,question_version_id,question_versions!inner(id,question_id,prompt,evidence_parameter,applies_to_respondent)")
    .eq("form_version_id", formVersionId)
    .order("order_index", { ascending: true });
  if (error) throw error;
  if ((data ?? []).length !== manifest.questions.length) {
    throw new Error(
      `A versão publicada possui ${(data ?? []).length} critérios; esperados ${manifest.questions.length}.`,
    );
  }
  return data.map((item, index) => {
    const version = unwrapRelation(item.question_versions);
    const expected = manifest.questions[index];
    if (!version || item.order_index !== index) {
      throw new Error(`Ordem inválida na versão publicada, posição ${index + 1}.`);
    }
    if (normalizeComparableText(version.prompt) !== normalizeComparableText(expected.prompt)) {
      throw new Error(`Critério ${index + 1} diverge entre o manifesto e a versão publicada.`);
    }
    const requiresEvidence = version.evidence_parameter?.required === true;
    if (requiresEvidence !== expected.requires_evidence) {
      throw new Error(`Critério ${index + 1} diverge quanto à exigência de evidência.`);
    }
    if (!version.applies_to_respondent) {
      throw new Error(`Critério ${index + 1} não está habilitado para respondentes.`);
    }
    return {
      orderIndex: item.order_index,
      questionVersionId: item.question_version_id,
      questionId: version.question_id,
      prompt: version.prompt,
      requiresEvidence,
    };
  });
}

async function updateRespondentRegistration({ supabase, record, target, actorUserId, dryRun }) {
  if (dryRun) return;
  if (target.profile.full_name !== record.respondent.full_name) {
    const { error: profileError } = await supabase.rpc("update_respondent_profile", {
      p_target_user_id: target.profile.user_id,
      p_full_name: record.respondent.full_name,
      p_organization_id: target.organization.id,
      p_actor_user_id: actorUserId,
    });
    if (profileError) throw profileError;
    target.profile.full_name = record.respondent.full_name;
  }

  const { error: detailsError } = await supabase.rpc("upsert_respondent_profile_details", {
    p_target_user_id: target.profile.user_id,
    p_registration_number: record.respondent.registration_number || null,
    p_organizational_unit: record.respondent.organizational_unit || null,
    p_position_title: record.respondent.position_title || null,
    p_source_submitted_at: record.submitted_at_source || null,
    p_declaration_text: record.respondent.declaration || null,
    p_source_name: DIAGNOSTIC_RESPONSE_SOURCE_NAME,
    p_actor_user_id: actorUserId,
  });
  if (detailsError) throw detailsError;
}

async function upsertWaivers({ supabase, record, target, questions, actorUserId, dryRun }) {
  if (record.waivers.length === 0 || dryRun) return;

  for (const waiver of record.waivers) {
    const question = questions[waiver.source_order - 1];
    const { error } = await supabase.rpc("upsert_question_organization_waiver", {
      p_organization_id: target.organization.id,
      p_question_id: question.questionId,
      p_reason: waiver.reason,
      p_actor_user_id: actorUserId,
    });
    if (error) {
      throw new Error(
        `${record.organization_acronym} — dispensa do critério ${waiver.source_order}: ${error.message}`,
      );
    }
  }
}

async function createOrOpenCycle({ supabase, formId, target, manifest, actorUserId }) {
  const { data, error } = await supabase.rpc("create_or_open_historical_cycle", {
    p_form_id: formId,
    p_organization_id: target.organization.id,
    p_period_label: manifest.period_label,
    p_actor_user_id: actorUserId,
  });
  if (error) throw error;
  const cycle = data?.cycle;
  if (!cycle?.id) throw new Error(`${target.organization.acronym}: ciclo não retornado.`);
  return { status: data.status, cycle };
}

async function persistResponses({ supabase, cycle, record, questions, respondentUserId }) {
  const waived = new Set(record.waivers.map((waiver) => waiver.source_order));
  let existingByQuestion = await loadCycleResponses(supabase, cycle.id);
  let changed = 0;

  for (const response of record.responses) {
    if (waived.has(response.source_order)) continue;
    const question = questions[response.source_order - 1];
    const existing = existingByQuestion.get(question.questionVersionId);
    const existingUrls = new Set(
      (existing?.evidences ?? [])
        .filter((evidence) => !evidence.deactivated_at && evidence.external_link)
        .map((evidence) => evidence.external_link),
    );
    const notes = buildImportedResponseNotes(response);
    const evidence = evidencePayload(response, existingUrls);
    const answerChanged = !existing || existing.answer !== response.answer;
    const notesChanged = (existing?.notes ?? null) !== notes;
    if (!answerChanged && !notesChanged && evidence.length === 0) continue;

    const { error } = await supabase.rpc("apply_workbench_response", {
      p_cycle_id: cycle.id,
      p_actor_user_id: respondentUserId,
      p_question_version_id: question.questionVersionId,
      p_answer: response.answer,
      p_notes: notes,
      p_expected_revision: existing?.revision ?? undefined,
      p_evidence: evidence,
    });
    if (error) throw new Error(`${record.organization_acronym} — critério ${response.source_order}: ${error.message}`);
    changed += 1;
  }
  return changed;
}


async function advanceHistoricalCycleToValidation({
  supabase,
  cycleId,
  respondentUserId,
  actorUserId,
}) {
  const { data, error } = await supabase.rpc("advance_historical_cycle_to_validation", {
    p_cycle_id: cycleId,
    p_respondent_user_id: respondentUserId,
    p_actor_user_id: actorUserId,
  });
  if (error) throw error;
  if (!data?.cycle?.state) throw new Error("A transição histórica não retornou o ciclo.");
  return data.cycle;
}

const HISTORICAL_ABSENT_PROOF_OBSERVATION =
  "Carga histórica do Diagnóstico de Integridade 2026: resposta Sim sem comprovação documental na fonte oficial.";

async function applyKnownEvidenceValidations({ supabase, cycleId, record, questions, actorUserId }) {
  const responseMap = await loadCycleResponses(supabase, cycleId);
  let reviewed = 0;
  let pending = 0;
  for (const item of record.responses) {
    const desired = expectedEvidenceValidationStatus(item);
    const question = questions[item.source_order - 1];
    const response = responseMap.get(question.questionVersionId);
    for (const evidence of response?.evidences ?? []) {
      if (evidence.deactivated_at) continue;
      if (evidence.validation_status === "pending" && desired) {
        const action = desired === "approved" ? "approve" : "invalidate";
        const { error } = await supabase.rpc("validate_evidence", {
          p_evidence_id: evidence.id,
          p_cycle_id: cycleId,
          p_action: action,
          p_actor_user_id: actorUserId,
          p_justification: action === "invalidate" ? "Evidência insuficiente." : null,
          p_expected_status: "pending",
          p_expected_validated_at: evidence.validated_at,
        });
        if (error) throw error;
        reviewed += 1;
      } else if (evidence.validation_status === "pending") {
        pending += 1;
      }
    }
  }
  return { reviewed, pending };
}

/**
 * Para --finalize: registra validate_without_proof nos Sim históricos sem documento,
 * usando a RPC administrativa oficial (sem inventar evidência).
 */
async function resolveHistoricalAbsentProof({
  supabase,
  cycleId,
  record,
  questions,
  actorUserId,
}) {
  const responseMap = await loadCycleResponses(supabase, cycleId);
  let resolved = 0;

  for (const item of record.responses) {
    if (item.answer !== "yes" || !item.requires_evidence) continue;
    if (responseEvidenceUrls(item).length > 0) continue;

    const question = questions[item.source_order - 1];
    const response = responseMap.get(question.questionVersionId);
    if (!response || response.answer !== "yes") continue;
    if (response.admin_applicability_status === "not_applicable") continue;
    if (response.admin_proof_status) continue;

    const activeEvidence = (response.evidences ?? []).filter((evidence) => !evidence.deactivated_at);
    if (activeEvidence.length > 0) continue;

    const { error } = await supabase.rpc("decide_response_without_proof", {
      p_response_id: response.id,
      p_cycle_id: cycleId,
      p_actor_user_id: actorUserId,
      p_action: "validate_without_proof",
      p_observation: HISTORICAL_ABSENT_PROOF_OBSERVATION,
      p_expected_status: null,
      p_expected_decided_at: null,
    });
    if (error) {
      throw new Error(
        `${record.organization_acronym} — critério ${item.source_order}: ${error.message}`,
      );
    }
    resolved += 1;
  }

  return resolved;
}

async function processRecord(context, record) {
  const { supabase, args, actorUserId, form, questions, targets, manifest } = context;
  const target = targets.get(record.organization_acronym);
  if (args.verifyOnly) {
    const issues = await verifyImportedRecord({
      supabase,
      record,
      target,
      formVersionId: form.current_form_version_id,
      questions,
      manifest,
    });
    return { acronym: record.organization_acronym, status: issues.length ? "divergent" : "verified", issues };
  }

  await updateRespondentRegistration({ supabase, record, target, actorUserId, dryRun: args.dryRun });
  await upsertWaivers({ supabase, record, target, questions, actorUserId, dryRun: args.dryRun });
  if (args.dryRun) {
    return {
      acronym: record.organization_acronym,
      status: "dry-run",
      answers: record.responses.length - record.waivers.length,
      waivers: record.waivers.length,
    };
  }

  const opened = await createOrOpenCycle({
    supabase,
    formId: form.id,
    target,
    manifest,
    actorUserId,
  });
  let state = opened.cycle.state;
  let saved = 0;
  let reviewed = 0;
  let pending = 0;

  if (state === "in_response") {
    saved = await persistResponses({
      supabase,
      cycle: opened.cycle,
      record,
      questions,
      respondentUserId: target.profile.user_id,
    });
  }
  if (["in_response", "submitted"].includes(state)) {
    const advancedCycle = await advanceHistoricalCycleToValidation({
      supabase,
      cycleId: opened.cycle.id,
      respondentUserId: target.profile.user_id,
      actorUserId,
    });
    state = advancedCycle.state;
  }
  let absentProofResolved = 0;
  if (state === "in_validation") {
    ({ reviewed, pending } = await applyKnownEvidenceValidations({
      supabase,
      cycleId: opened.cycle.id,
      record,
      questions,
      actorUserId,
    }));
    if (args.finalize) {
      absentProofResolved = await resolveHistoricalAbsentProof({
        supabase,
        cycleId: opened.cycle.id,
        record,
        questions,
        actorUserId,
      });
    }
    if (args.finalize && pending === 0) {
      const { error } = await supabase.rpc("finalize_validation_cycle", {
        p_cycle_id: opened.cycle.id,
        p_actor_user_id: actorUserId,
      });
      if (error) throw error;
      state = "validated";
    }
  } else if (!["validated", "completed"].includes(state)) {
    throw new Error(`${record.organization_acronym}: estado não importável ${state}.`);
  }

  return {
    acronym: record.organization_acronym,
    status: state,
    saved,
    reviewed,
    pending,
    absentProofResolved,
    waivers: record.waivers.length,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (!existsSync(args.file)) throw new Error(`Manifesto não encontrado: ${args.file}`);
  if (!existsSync(args.accountsFile)) throw new Error(`Arquivo de contas não encontrado: ${args.accountsFile}`);
  const manifest = loadDiagnosticImportManifest(args.file);
  const supabase = createServiceRoleSupabaseClient();
  const actorUserId = await resolveGlobalAdminId(supabase);
  const accounts = parseRespondentSeed(readFileSync(args.accountsFile, "utf8"));
  const { targets, allOrganizationIds } = await loadOrganizationsAndRespondents(
    supabase,
    manifest,
    accounts,
  );
  let form = await loadForm(supabase, manifest.form_name);
  await syncAssignments(supabase, form.id, allOrganizationIds, actorUserId, args.dryRun);
  form = await ensurePublishedForm(supabase, form, actorUserId, args);
  const questions = await loadPublishedQuestions(
    supabase,
    form.current_form_version_id,
    manifest,
  );
  if (args.verifyOnly) {
    const { data: assignments, error: assignmentError } = await supabase
      .from("form_assignments")
      .select("organization_id")
      .eq("form_id", form.id);
    if (assignmentError) throw assignmentError;
    const assigned = new Set((assignments ?? []).map((item) => item.organization_id));
    const missing = allOrganizationIds.filter((organizationId) => !assigned.has(organizationId));
    if (missing.length > 0 || assigned.size !== allOrganizationIds.length) {
      throw new Error(`Atribuições divergentes: ${assigned.size}/${allOrganizationIds.length}.`);
    }
  }

  const context = { supabase, args, actorUserId, form, questions, targets, manifest };
  const results = [];
  for (const record of manifest.records) {
    results.push(await processRecord(context, record));
    const result = results.at(-1);
    console.log(
      `✓ ${result.acronym}: ${result.status}`
      + (result.pending ? `, ${result.pending} evidência(s) pendente(s)` : "")
      + (result.issues?.length ? ` — ${result.issues.join("; ")}` : ""),
    );
  }

  const divergent = results.filter((result) => result.status === "divergent");
  console.log(`\n${results.length} órgão(s) processado(s).`);
  if (args.dryRun && !args.verifyOnly) console.log("Nenhuma alteração foi gravada (--dry-run).");
  if (divergent.length > 0) {
    throw new Error(`${divergent.length} órgão(s) apresentam divergências na verificação.`);
  }
}

main().catch((error) => {
  console.error(`\n✖ ${error?.message ?? String(error)}\n`);
  process.exit(1);
});
