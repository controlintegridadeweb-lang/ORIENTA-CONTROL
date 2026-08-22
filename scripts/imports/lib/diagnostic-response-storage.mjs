import {
  buildImportedResponseNotes,
  expectedEvidenceValidationStatus,
  responseEvidenceUrls,
} from "./diagnostic-response-import.mjs";

export const DIAGNOSTIC_RESPONSE_SOURCE_NAME =
  "Diagnóstico de Integridade 2026 — planilha histórica";

export async function loadCycleResponses(supabase, cycleId) {
  const { data, error } = await supabase
    .from("responses")
    .select(
      "id,question_version_id,answer,notes,revision,admin_proof_status,admin_proof_decided_at,admin_applicability_status",
    )
    .eq("cycle_id", cycleId);
  if (error) throw error;

  const responseIds = (data ?? []).map((item) => item.id);
  let evidences = [];
  if (responseIds.length > 0) {
    const { data: evidenceRows, error: evidenceError } = await supabase
      .from("evidences")
      .select("id,response_id,external_link,validation_status,validated_at,deactivated_at")
      .in("response_id", responseIds);
    if (evidenceError) throw evidenceError;
    evidences = evidenceRows ?? [];
  }

  const evidenceByResponse = new Map();
  for (const evidence of evidences) {
    const current = evidenceByResponse.get(evidence.response_id) ?? [];
    current.push(evidence);
    evidenceByResponse.set(evidence.response_id, current);
  }

  return new Map((data ?? []).map((response) => [
    response.question_version_id,
    { ...response, evidences: evidenceByResponse.get(response.id) ?? [] },
  ]));
}

export async function verifyImportedRecord({
  supabase,
  record,
  target,
  formVersionId,
  questions,
  manifest,
}) {
  const issues = [];
  const { data: details, error: detailsError } = await supabase
    .from("respondent_profile_details")
    .select("registration_number,organizational_unit,position_title,source_submitted_at,declaration_text,source_name")
    .eq("user_id", target.profile.user_id)
    .maybeSingle();
  if (detailsError) throw detailsError;

  if (!details) {
    issues.push("dados cadastrais ausentes");
  } else {
    const expectedDetails = {
      registration_number: record.respondent.registration_number || null,
      organizational_unit: record.respondent.organizational_unit || null,
      position_title: record.respondent.position_title || null,
      source_submitted_at: record.submitted_at_source || null,
      declaration_text: record.respondent.declaration || null,
      source_name: DIAGNOSTIC_RESPONSE_SOURCE_NAME,
    };
    for (const [field, expected] of Object.entries(expectedDetails)) {
      const actual = details[field] ?? null;
      const matches = field === "source_submitted_at" && actual && expected
        ? Date.parse(actual) === Date.parse(expected)
        : actual === expected;
      if (!matches) issues.push(`dado cadastral divergente: ${field}`);
    }
  }
  if (target.profile.full_name !== record.respondent.full_name) {
    issues.push("nome do perfil divergente");
  }

  const { data: cycles, error: cycleError } = await supabase
    .from("cycles")
    .select("id,state")
    .eq("organization_id", target.organization.id)
    .eq("form_version_id", formVersionId)
    .eq("period_label", manifest.period_label);
  if (cycleError) throw cycleError;
  if ((cycles ?? []).length !== 1) {
    issues.push(`esperado 1 ciclo; encontrados ${(cycles ?? []).length}`);
    return issues;
  }

  const cycle = cycles[0];
  if (!["in_validation", "validated", "completed"].includes(cycle.state)) {
    issues.push(`estado inesperado: ${cycle.state}`);
  }

  const responseMap = await loadCycleResponses(supabase, cycle.id);
  const waived = new Set(record.waivers.map((waiver) => waiver.source_order));
  const expectedResponseCount = record.responses.length - waived.size;
  if (responseMap.size !== expectedResponseCount) {
    issues.push(`respostas ${responseMap.size}/${expectedResponseCount}`);
  }

  for (const expectedResponse of record.responses) {
    if (waived.has(expectedResponse.source_order)) continue;
    const question = questions[expectedResponse.source_order - 1];
    const actual = responseMap.get(question.questionVersionId);
    if (!actual) {
      issues.push(`critério ${expectedResponse.source_order}: resposta ausente`);
      continue;
    }
    if (actual.answer !== expectedResponse.answer) {
      issues.push(`critério ${expectedResponse.source_order}: resposta divergente`);
    }
    if ((actual.notes ?? null) !== buildImportedResponseNotes(expectedResponse)) {
      issues.push(`critério ${expectedResponse.source_order}: notas divergentes`);
    }

    const expectedUrls = new Set(responseEvidenceUrls(expectedResponse));
    const activeEvidence = (actual.evidences ?? []).filter(
      (evidence) => !evidence.deactivated_at,
    );
    const actualUrls = new Set(
      activeEvidence.map((evidence) => evidence.external_link).filter(Boolean),
    );
    if (
      expectedUrls.size !== actualUrls.size ||
      [...expectedUrls].some((url) => !actualUrls.has(url))
    ) {
      issues.push(`critério ${expectedResponse.source_order}: evidências divergentes`);
    }

    const expectedValidation =
      expectedEvidenceValidationStatus(expectedResponse) ?? "pending";
    if (
      activeEvidence.some(
        (evidence) => evidence.validation_status !== expectedValidation,
      )
    ) {
      issues.push(`critério ${expectedResponse.source_order}: parecer de evidência divergente`);
    }
  }

  const { data: waiverRows, error: waiverError } = await supabase
    .from("question_organization_waivers")
    .select("question_id,reason")
    .eq("organization_id", target.organization.id)
    .in("question_id", questions.map((question) => question.questionId));
  if (waiverError) throw waiverError;

  const waiverByQuestion = new Map(
    (waiverRows ?? []).map((waiver) => [waiver.question_id, waiver.reason]),
  );
  if (waiverByQuestion.size !== record.waivers.length) {
    issues.push(`dispensas ${waiverByQuestion.size}/${record.waivers.length}`);
  }
  for (const waiver of record.waivers) {
    const question = questions[waiver.source_order - 1];
    if (waiverByQuestion.get(question.questionId) !== waiver.reason) {
      issues.push(`critério ${waiver.source_order}: dispensa divergente`);
    }
  }

  return issues;
}
