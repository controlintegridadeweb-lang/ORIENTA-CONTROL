/**
 * Auditoria completa das seções da validação vs estrutura da form_version aplicada.
 *
 * Uso:
 *   node scripts/maintenance/audit-validation-sections.mjs [cycleId?]
 *   node scripts/maintenance/audit-validation-sections.mjs --all-in-validation
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../shared/load-env.mjs";

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE credentials");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const args = process.argv.slice(2);
const allInValidation = args.includes("--all-in-validation");
const cycleIdArg = args.find((a) => !a.startsWith("--")) ?? null;

async function fetchAll(table, select, apply) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    let q = supabase.from(table).select(select).range(from, from + pageSize - 1);
    q = apply ? apply(q) : q;
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function isEvidenceRequired(evidenceParameter) {
  if (!evidenceParameter || typeof evidenceParameter !== "object" || Array.isArray(evidenceParameter)) {
    return false;
  }
  return evidenceParameter.required === true;
}

function deriveGroupStatus(docs, answer, requiresEvidence, adminNa) {
  if (adminNa === "not_applicable") return "admin_not_applicable";
  if (answer === "not_applicable") return "respondent_na";
  if (!(answer === "yes" && requiresEvidence)) return "out_of_evidence_queue";
  if (!docs.length) return "not_presented";
  if (docs.some((d) => d.validation_status === "adjustment_requested")) {
    return "adjustment_requested";
  }
  if (docs.some((d) => d.validation_status === "pending")) return "pending";
  if (docs.some((d) => d.validation_status === "approved")) return "approved";
  return "invalidated";
}

async function auditCycle(cycle) {
  const formVersionId = cycle.form_version_id;
  const cycleId = cycle.id;

  const formQuestions = await fetchAll(
    "form_questions",
    "order_index, question_version_id, question_versions!inner(id, question_id, prompt, section_id, section_name, section_order, axis_id, axis_name, evidence_parameter, fami_enabled, applies_to_respondent)",
    (q) => q.eq("form_version_id", formVersionId).order("order_index", { ascending: true }),
  );

  const responses = await fetchAll(
    "responses",
    "id, question_version_id, answer, is_not_applicable, na_validation_status, admin_applicability_status, admin_na_justification",
    (q) => q.eq("cycle_id", cycleId),
  );

  const responseIds = responses.map((r) => r.id);
  const evidences = [];
  for (let i = 0; i < responseIds.length; i += 100) {
    const chunk = responseIds.slice(i, i + 100);
    if (!chunk.length) break;
    const { data, error } = await supabase
      .from("evidences")
      .select("id, response_id, validation_status, deactivated_at")
      .in("response_id", chunk)
      .is("deactivated_at", null);
    if (error) throw error;
    evidences.push(...(data ?? []));
  }

  const evidencesByResponse = new Map();
  for (const e of evidences) {
    const list = evidencesByResponse.get(e.response_id) ?? [];
    list.push(e);
    evidencesByResponse.set(e.response_id, list);
  }
  const responseByQv = new Map(responses.map((r) => [r.question_version_id, r]));

  const { data: summary, error: summaryErr } = await supabase.rpc(
    "get_validation_queue_summary",
    { p_cycle_id: cycleId },
  );
  if (summaryErr) throw summaryErr;

  const selectorEvidence = new Map(
    (summary?.evidenceSections ?? []).map((s) => [s.id, s]),
  );
  const selectorNa = new Map(
    (summary?.notApplicableSections ?? []).map((s) => [s.id, s]),
  );
  const selectorUnionIds = new Set([
    ...selectorEvidence.keys(),
    ...selectorNa.keys(),
  ]);

  /** @type {Map<string, any>} */
  const officialSections = new Map();
  for (const fq of formQuestions) {
    const qv = fq.question_versions;
    const sectionId = qv.section_id;
    const response = responseByQv.get(fq.question_version_id) ?? null;
    const docs = response ? evidencesByResponse.get(response.id) ?? [] : [];
    const requiresEvidence = isEvidenceRequired(qv.evidence_parameter);
    const adminNa = response?.admin_applicability_status ?? null;
    const status = deriveGroupStatus(
      docs,
      response?.answer ?? null,
      requiresEvidence,
      adminNa,
    );

    const row = officialSections.get(sectionId) ?? {
      sectionId,
      sectionName: qv.section_name,
      sectionOrder: qv.section_order,
      axisId: qv.axis_id,
      axisName: qv.axis_name,
      criteriaTotal: 0,
      criteriaRequiresEvidence: 0,
      answered: 0,
      respondentNa: 0,
      adminNa: 0,
      evidenceQueue: 0,
      pending: 0,
      approved: 0,
      invalidated: 0,
      notPresented: 0,
      adjustmentRequested: 0,
      outOfQueue: 0,
      unanswered: 0,
      axisIds: new Set(),
      sectionNames: new Set(),
    };
    row.criteriaTotal += 1;
    row.axisIds.add(qv.axis_id);
    row.sectionNames.add(qv.section_name);
    if (requiresEvidence) row.criteriaRequiresEvidence += 1;
    if (!response) {
      row.unanswered += 1;
    } else {
      row.answered += 1;
      if (response.answer === "not_applicable" || response.na_validation_status === "rejected") {
        row.respondentNa += 1;
      }
      if (adminNa === "not_applicable") row.adminNa += 1;
      if (status === "pending") row.pending += 1;
      else if (status === "approved") row.approved += 1;
      else if (status === "invalidated") row.invalidated += 1;
      else if (status === "not_presented") row.notPresented += 1;
      else if (status === "adjustment_requested") row.adjustmentRequested += 1;
      else if (status === "out_of_evidence_queue") row.outOfQueue += 1;
      if (
        response.answer === "yes" &&
        requiresEvidence &&
        adminNa !== "not_applicable"
      ) {
        row.evidenceQueue += 1;
      }
    }
    officialSections.set(sectionId, row);
  }

  const officialAxes = new Map();
  for (const section of officialSections.values()) {
    const axis = officialAxes.get(section.axisId) ?? {
      axisId: section.axisId,
      axisName: section.axisName,
      sectionCount: 0,
    };
    axis.sectionCount += 1;
    officialAxes.set(section.axisId, axis);
  }

  // Respostas cujo question_version não está na form_version aplicada
  const orphanResponses = responses.filter(
    (r) => !formQuestions.some((fq) => fq.question_version_id === r.question_version_id),
  );

  const table = [...officialSections.values()]
    .sort(
      (a, b) =>
        a.axisName.localeCompare(b.axisName, "pt-BR") ||
        a.sectionOrder - b.sectionOrder ||
        a.sectionName.localeCompare(b.sectionName, "pt-BR"),
    )
    .map((s) => {
      const inEvidenceSelector = selectorEvidence.has(s.sectionId);
      const inNaSelector = selectorNa.has(s.sectionId);
      const inSelector = selectorUnionIds.has(s.sectionId);
      const toValidate =
        s.pending + s.notPresented + s.adjustmentRequested + s.respondentNa;
      const completed =
        s.approved + s.invalidated + s.adminNa +
        (s.respondentNa > 0
          ? Math.max(
              0,
              (selectorNa.get(s.sectionId)?.completedCount ?? 0),
            )
          : 0);

      let situacao = "Correta";
      const divergencias = [];
      if (s.criteriaTotal === 0) {
        situacao = "Sem critérios";
        divergencias.push("section_without_criteria");
      }
      if (s.answered === 0 && s.criteriaTotal > 0) {
        situacao = "Sem respostas";
        divergencias.push("section_without_responses");
      }
      if (s.axisIds.size > 1) {
        situacao = "Eixo inconsistente";
        divergencias.push("section_linked_to_multiple_axes");
      }
      if (s.sectionNames.size > 1) {
        situacao = "Nome duplicado/inconsistente";
        divergencias.push("section_name_inconsistency");
      }
      if (!inSelector && (s.evidenceQueue > 0 || s.respondentNa > 0 || s.adminNa > 0)) {
        situacao = "Ausente no seletor com itens para validar";
        divergencias.push("missing_from_selector_with_queue_items");
      } else if (!inSelector && s.criteriaTotal > 0) {
        situacao = "Ausente no seletor (sem itens elegíveis na fila)";
        divergencias.push("missing_from_selector_no_queue_items");
      }
      if (inSelector && s.evidenceQueue === 0 && s.respondentNa === 0 && s.adminNa === 0) {
        divergencias.push("in_selector_without_official_queue_items");
      }

      return {
        axisId: s.axisId,
        axisName: s.axisName,
        sectionId: s.sectionId,
        sectionName: s.sectionName,
        sectionOrder: s.sectionOrder,
        criteriaTotal: s.criteriaTotal,
        criteriaRequiresEvidence: s.criteriaRequiresEvidence,
        answered: s.answered,
        unanswered: s.unanswered,
        evidenceQueue: s.evidenceQueue,
        toValidateEvidence: s.pending + s.notPresented + s.adjustmentRequested,
        pending: s.pending,
        approved: s.approved,
        invalidated: s.invalidated,
        notPresented: s.notPresented,
        adjustmentRequested: s.adjustmentRequested,
        respondentNa: s.respondentNa,
        adminNa: s.adminNa,
        completedEvidence: s.approved + s.invalidated + s.notPresented,
        inEvidenceSelector,
        inNaSelector,
        inSelector,
        selectorEvidencePending: selectorEvidence.get(s.sectionId)?.pendingCount ?? 0,
        selectorEvidenceTotal: selectorEvidence.get(s.sectionId)?.totalCount ?? 0,
        selectorNaPending: selectorNa.get(s.sectionId)?.pendingCount ?? 0,
        selectorNaTotal: selectorNa.get(s.sectionId)?.totalCount ?? 0,
        situacao,
        divergencias,
        toValidate,
        completed,
      };
    });

  const selectorOnly = [...selectorUnionIds].filter((id) => !officialSections.has(id));
  const officialCount = officialSections.size;
  const selectorCount = selectorUnionIds.size;
  const absentFromSelector = table.filter((r) => !r.inSelector);
  const absentWithQueue = absentFromSelector.filter(
    (r) => r.evidenceQueue > 0 || r.respondentNa > 0 || r.adminNa > 0,
  );
  const absentWithoutQueue = absentFromSelector.filter(
    (r) => r.evidenceQueue === 0 && r.respondentNa === 0 && r.adminNa === 0,
  );

  return {
    cycle: {
      id: cycleId,
      state: cycle.state,
      organizationId: cycle.organization_id,
      organizationName: cycle.organizations?.name ?? null,
      formVersionId,
      formName: cycle.form_versions?.forms?.name ?? null,
      formVersion: cycle.form_versions?.version ?? null,
      periodLabel: cycle.period_label,
    },
    totals: {
      expectedAxes: officialAxes.size,
      expectedSections: officialCount,
      sectionsInApplication: officialCount,
      sectionsInSelector: selectorCount,
      sectionsAbsentFromSelector: absentFromSelector.length,
      sectionsAbsentWithQueueItems: absentWithQueue.length,
      sectionsAbsentWithoutQueueItems: absentWithoutQueue.length,
      sectionsOnlyInSelector: selectorOnly.length,
      sectionsWithoutCriteria: table.filter((r) => r.criteriaTotal === 0).length,
      sectionsWithoutResponses: table.filter((r) => r.answered === 0).length,
      criteriaTotal: formQuestions.length,
      responsesTotal: responses.length,
      orphanResponses: orphanResponses.length,
      summaryCaption:
        absentFromSelector.length === 0
          ? `${selectorCount} de ${officialCount} seções conferidas — nenhuma seção ausente`
          : `${selectorCount} de ${officialCount} seções exibidas — ${absentWithoutQueue.length} seções sem itens para validar` +
            (absentWithQueue.length
              ? `; ${absentWithQueue.length} ausentes indevidamente`
              : ""),
    },
    axes: [...officialAxes.values()],
    selectorOnlySectionIds: selectorOnly,
    orphanResponseIds: orphanResponses.map((r) => r.id),
    summaryRpc: {
      evidence: summary?.evidence ?? null,
      notApplicable: summary?.notApplicable ?? null,
      evidenceSectionCount: summary?.evidenceSections?.length ?? 0,
      notApplicableSectionCount: summary?.notApplicableSections?.length ?? 0,
    },
    table,
    divergences: {
      missingFromSelectorWithQueueItems: absentWithQueue.map((r) => ({
        sectionId: r.sectionId,
        sectionName: r.sectionName,
        axisName: r.axisName,
        cause:
          "Seção tem itens elegíveis, mas get_validation_queue_summary só agrega seções a partir de respostas da fila — investigar filtro/JOIN.",
      })),
      missingFromSelectorWithoutQueueItems: absentWithoutQueue.map((r) => ({
        sectionId: r.sectionId,
        sectionName: r.sectionName,
        axisName: r.axisName,
        cause:
          "Seção oficial da form_version sem critérios elegíveis na fila (Sim+evidência ou N/A). Ausente porque o seletor é queue-derived, não structure-derived.",
      })),
      selectorOnly: selectorOnly.map((id) => ({
        sectionId: id,
        cause:
          "Seção aparece no seletor sem existir na form_version aplicada (versão errada, órfã ou snapshot inconsistente).",
      })),
      orphanResponses: orphanResponses.map((r) => ({
        responseId: r.id,
        questionVersionId: r.question_version_id,
        cause: "Resposta aponta para question_version fora da form_version do ciclo.",
      })),
    },
  };
}

const cycleSelect =
  "id, state, form_version_id, organization_id, period_label, organizations(name), form_versions(version, form_id, forms!form_versions_form_id_fkey(name))";

let selected = [];
if (cycleIdArg) {
  const { data, error } = await supabase
    .from("cycles")
    .select(cycleSelect)
    .eq("id", cycleIdArg)
    .maybeSingle();
  if (error) throw error;
  selected = data ? [data] : [];
} else {
  let q = supabase
    .from("cycles")
    .select(cycleSelect)
    .eq("state", "in_validation")
    .order("updated_at", { ascending: false });
  if (!allInValidation) q = q.limit(8);
  const { data, error } = await q;
  if (error) throw error;
  selected = data ?? [];
  if (selected.length === 0) {
    const { data: fallback, error: fallbackErr } = await supabase
      .from("cycles")
      .select(cycleSelect)
      .in("state", ["in_validation", "submitted", "validated", "awaiting_adjustment"])
      .order("updated_at", { ascending: false })
      .limit(5);
    if (fallbackErr) throw fallbackErr;
    selected = fallback ?? [];
  }
}

const reports = [];
for (const cycle of selected) {
  reports.push(await auditCycle(cycle));
}

const aggregate = {
  generatedAt: new Date().toISOString(),
  cycleCount: reports.length,
  rootCause:
    "O seletor é alimentado por evidenceSections/notApplicableSections de get_validation_queue_summary, que agrega apenas respostas elegíveis na fila — não pela estrutura form_questions da form_version aplicada.",
  reports,
};

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "var");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "audit-validation-sections.json");
writeFileSync(outPath, JSON.stringify(aggregate, null, 2), "utf8");
console.log(JSON.stringify(aggregate, null, 2));
console.error(`\nWrote ${outPath}`);
