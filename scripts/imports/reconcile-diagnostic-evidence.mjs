#!/usr/bin/env node

/**
 * Reconcilia evidências históricas do Diagnóstico 2026 com o mapeamento
 * explícito coluna auxiliar → critério oficial.
 *
 * Idempotente: pode ser reexecutado sem duplicar links nem recriar respostas.
 */

import { resolve } from "node:path";
import { createServiceRoleSupabaseClient } from "../shared/create-service-role-supabase-client.mjs";
import { loadDiagnosticImportManifest } from "./lib/diagnostic-response-import.mjs";
import {
  expectedEvidenceLinksBySourceOrder,
  orphanEvidenceUrls,
} from "./lib/remap-diagnostic-supporting-fields.mjs";
import { supportingFieldContributesEvidence } from "./lib/diagnostic-integrity-2026-supporting-map.mjs";

function printHelp() {
  console.log(`
Uso:
  node scripts/imports/reconcile-diagnostic-evidence.mjs --file <manifesto.json> [--dry-run]

Opções:
  --file <json>   Manifesto v2 (será remapeado automaticamente na carga)
  --dry-run       Apenas calcula divergências, sem gravar
  --help          Exibe esta ajuda

Pré-requisito: schema/migrations atuais aplicados e administrador global existente.
`);
}

function parseArgs(argv) {
  const args = { file: null, dryRun: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help") args.help = true;
    else if (token === "--dry-run") args.dryRun = true;
    else if (token === "--file") args.file = resolve(argv[++index] ?? "");
    else throw new Error(`Opção desconhecida: ${token}`);
  }
  if (!args.help && !args.file) throw new Error("Informe o manifesto com --file.");
  return args;
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

async function loadPublishedFormQuestions(supabase, formName) {
  const { data: form, error } = await supabase
    .from("forms")
    .select("id,name,current_form_version_id")
    .eq("name", formName)
    .maybeSingle();
  if (error) throw error;
  if (!form?.current_form_version_id) {
    throw new Error(`Formulário publicado não encontrado: ${formName}`);
  }
  const { data: formQuestions, error: fqError } = await supabase
    .from("form_questions")
    .select("order_index,question_version_id")
    .eq("form_version_id", form.current_form_version_id)
    .order("order_index", { ascending: true });
  if (fqError) throw fqError;
  if ((formQuestions ?? []).length !== 126) {
    throw new Error(`Formulário com ${(formQuestions ?? []).length} critérios; esperados 126.`);
  }
  return formQuestions.map((item) => item.question_version_id);
}

async function findCycleForOrganization(supabase, organizationAcronym, periodLabel) {
  const { data: organizations, error: orgError } = await supabase
    .from("organizations")
    .select("id,acronym")
    .eq("acronym", organizationAcronym)
    .limit(1);
  if (orgError) throw orgError;
  const organization = organizations?.[0];
  if (!organization) throw new Error(`Órgão não encontrado: ${organizationAcronym}`);

  const { data: cycles, error: cycleError } = await supabase
    .from("cycles")
    .select("id,state,period_label,organization_id")
    .eq("organization_id", organization.id)
    .eq("period_label", periodLabel)
    .order("created_at", { ascending: false })
    .limit(1);
  if (cycleError) throw cycleError;
  return cycles?.[0] ?? null;
}

function fieldMetaByUrl(record) {
  /** @type {Map<string, { source_column: number, source_header: string, source_order: number }>} */
  const map = new Map();
  for (const response of record.responses) {
    for (const field of response.supporting_fields ?? []) {
      if (field.contributes_evidence === false) continue;
      if (!supportingFieldContributesEvidence(field.source_column)) continue;
      for (const url of field.urls ?? []) {
        if (!map.has(url)) {
          map.set(url, {
            source_column: field.source_column,
            source_header: field.source_header,
            source_order: response.source_order,
          });
        }
      }
    }
  }
  return map;
}

async function reconcileRecord({
  supabase,
  actorUserId,
  questionVersionIds,
  record,
  periodLabel,
  dryRun,
}) {
  const cycle = await findCycleForOrganization(
    supabase,
    record.organization_acronym,
    periodLabel,
  );
  if (!cycle) {
    return {
      organization: record.organization_acronym,
      status: "cycle_missing",
      moved: 0,
      inserted: 0,
      already: 0,
      skipped: 0,
      deactivatedOrphans: 0,
    };
  }

  const expected = expectedEvidenceLinksBySourceOrder(record);
  const metaByUrl = fieldMetaByUrl(record);
  const summary = {
    organization: record.organization_acronym,
    cycleId: cycle.id,
    status: "ok",
    copied: 0,
    inserted: 0,
    already: 0,
    skipped: 0,
    deactivatedOrphans: 0,
    deactivatedMisplaced: 0,
  };

  for (const [sourceOrder, urls] of expected.entries()) {
    const questionVersionId = questionVersionIds[sourceOrder - 1];
    for (const url of urls) {
      const meta = metaByUrl.get(url);
      if (!meta) {
        throw new Error(
          `${record.organization_acronym} critério ${sourceOrder}: URL sem metadado de coluna legada.`,
        );
      }
      if (dryRun) {
        summary.copied += 1;
        continue;
      }
      const { data, error } = await supabase.rpc("reconcile_legacy_evidence_link", {
        p_cycle_id: cycle.id,
        p_actor_user_id: actorUserId,
        p_target_question_version_id: questionVersionId,
        p_external_link: url,
        p_legacy_source_column: meta.source_column,
        p_legacy_source_header: meta.source_header,
        p_desired_validation_status: "approved",
      });
      if (error) {
        throw new Error(
          `${record.organization_acronym} critério ${sourceOrder}: ${error.message}`,
        );
      }
      const status = data?.status;
      if (status === "copied_to_target" || status === "moved_to_target") summary.copied += 1;
      else if (status === "inserted_on_target") summary.inserted += 1;
      else if (status === "already_on_target") summary.already += 1;
      else if (status === "skipped_non_yes") summary.skipped += 1;
    }
  }

  if (!dryRun) {
    summary.deactivatedMisplaced = await deactivateUnexpectedLegacyLinks({
      supabase,
      cycleId: cycle.id,
      actorUserId,
      questionVersionIds,
      expected,
    });
  }

  for (const url of orphanEvidenceUrls(record)) {
    if (dryRun) {
      summary.deactivatedOrphans += 1;
      continue;
    }
    const { data, error } = await supabase.rpc("deactivate_misplaced_legacy_evidence_link", {
      p_cycle_id: cycle.id,
      p_actor_user_id: actorUserId,
      p_external_link: url,
      p_reason:
        "Campo complementar legado sem critério oficial no catálogo; removido da evidência ativa e preservado em metadado/notas.",
    });
    if (error) {
      throw new Error(`${record.organization_acronym} órfão: ${error.message}`);
    }
    summary.deactivatedOrphans += data?.count ?? 0;
  }

  return summary;
}

async function deactivateUnexpectedLegacyLinks({
  supabase,
  cycleId,
  actorUserId,
  questionVersionIds,
  expected,
}) {
  const allowed = new Set();
  for (const [sourceOrder, urls] of expected.entries()) {
    const questionVersionId = questionVersionIds[sourceOrder - 1];
    for (const url of urls) allowed.add(`${questionVersionId}::${url}`);
  }

  const { data: responses, error } = await supabase
    .from("responses")
    .select("id,question_version_id,evidences(id,external_link,link_reason,deactivated_at,kind)")
    .eq("cycle_id", cycleId);
  if (error) throw error;

  let deactivated = 0;
  for (const response of responses ?? []) {
    for (const evidence of response.evidences ?? []) {
      if (evidence.deactivated_at || evidence.kind !== "link" || !evidence.external_link) continue;
      if (!String(evidence.link_reason ?? "").includes("formulário legado")) continue;
      const key = `${response.question_version_id}::${evidence.external_link}`;
      if (allowed.has(key)) continue;
      const { error: updateError } = await supabase
        .from("evidences")
        .update({ deactivated_at: new Date().toISOString() })
        .eq("id", evidence.id)
        .is("deactivated_at", null);
      if (updateError) throw updateError;
      await supabase.from("audit_logs").insert({
        actor_user_id: actorUserId,
        event_type: "legacy_evidence_misplaced_deactivated",
        entity_type: "evidence",
        record_id: evidence.id,
        before_json: {
          response_id: response.id,
          external_link: evidence.external_link,
        },
        after_json: {
          action: "deactivated_unexpected_on_criterion",
          question_version_id: response.question_version_id,
        },
      });
      deactivated += 1;
    }
  }
  return deactivated;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();

  const manifest = loadDiagnosticImportManifest(args.file);
  const supabase = createServiceRoleSupabaseClient();
  const actorUserId = await resolveGlobalAdminId(supabase);
  const questionVersionIds = await loadPublishedFormQuestions(supabase, manifest.form_name);

  const results = [];
  for (const record of manifest.records) {
    results.push(
      await reconcileRecord({
        supabase,
        actorUserId,
        questionVersionIds,
        record,
        periodLabel: manifest.period_label,
        dryRun: args.dryRun,
      }),
    );
  }

  const totals = results.reduce(
    (acc, item) => {
      acc.copied += item.copied;
      acc.inserted += item.inserted;
      acc.already += item.already;
      acc.skipped += item.skipped;
      acc.deactivatedOrphans += item.deactivatedOrphans;
      acc.deactivatedMisplaced += item.deactivatedMisplaced ?? 0;
      if (item.status === "cycle_missing") acc.missingCycles += 1;
      return acc;
    },
    {
      copied: 0,
      inserted: 0,
      already: 0,
      skipped: 0,
      deactivatedOrphans: 0,
      deactivatedMisplaced: 0,
      missingCycles: 0,
    },
  );

  console.log(
    args.dryRun
      ? "✓ Dry-run da reconciliação de evidências legadas"
      : "✓ Reconciliação de evidências legadas concluída",
  );
  console.log(
    `✓ órgãos=${results.length} copied=${totals.copied} inserted=${totals.inserted} already=${totals.already} skipped_non_yes=${totals.skipped} orphans_deactivated=${totals.deactivatedOrphans} misplaced_deactivated=${totals.deactivatedMisplaced} cycles_missing=${totals.missingCycles}`,
  );
  for (const item of results.filter((row) => row.status === "cycle_missing")) {
    console.log(`  ⚠ ciclo ausente: ${item.organization}`);
  }
}

try {
  await main();
} catch (error) {
  console.error(`\n✖ ${error?.message ?? String(error)}\n`);
  process.exit(1);
}
