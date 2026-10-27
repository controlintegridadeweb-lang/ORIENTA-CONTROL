/**
 * Classifica registros da homologação para uma limpeza futura.
 * Este módulo não exclui nada e não altera estado de ciclo.
 */
export const AUTHORIZED_HOMOLOGACAO_PROJECT = "fqexokfsjadrbrvcsfax";
export const JOURNEY_FORM_PREFIX = "Diagnóstico E2E - Jornada Canônica";
export const CATALOG_FORM_NAME = "Diagnóstico de Integridade 2026";
export const PERMANENT_ORGS = ["Órgão de Teste E2E", "Órgão Externo E2E"];
export const PERMANENT_EMAILS = [
  "admin.e2e@orienta.local",
  "respondente.e2e@orienta.local",
  "suplente.alfa@orienta.test",
  "respondente.externo.e2e@orienta.local",
  "suplente.beta@orienta.test",
];
export const PERMANENT_AXES = ["Ambiental", "Governanca", "Social"];
export const JOURNEY_SUFFIXES = ["", "percentual"];

const RUN_ID_PATTERN = /^[A-Za-z0-9-]{4,24}$/;
const COLLECTING_STATES = new Set(["in_response", "awaiting_adjustment"]);

export const SAFE_CLEANUP_ORDER = [
  "Conferir o projeto fqexokfsjadrbrvcsfax, os bloqueios e a fila de revisão manual. Sem autorização explícita, nenhuma exclusão ocorre.",
  "Não pausar coleta e não alterar o estado dos ciclos para enquadrar a função do produto.",
  "Não chamar delete_unpublished_form nem admin_delete_suspended_form nesta etapa.",
  "Se uma exclusão futura for autorizada, remover somente caminhos exclusivos pela API dos buckets evidencias, relatorios e planos-acao, depois da RPC já existente.",
  "Manter audit_logs e library_audit_events. O gatilho append-only recusa update, delete e truncate.",
  "Não remover contas. As cinco contas-base, os dois órgãos, os três eixos, o catálogo e os registros sem identificador corroborado ficam fora da seleção.",
];

export function assertPreviewOnly(argv) {
  if (argv.includes("--execute")) {
    throw new Error(
      "A prévia não exclui registros. A limpeza da homologação continua sem autorização de execução.",
    );
  }
}

export function assertAuthorizedHomologacaoProject(projectRef) {
  if (projectRef !== AUTHORIZED_HOMOLOGACAO_PROJECT) {
    throw new Error("Destino diferente do projeto de homologação autorizado.");
  }
}

export function isAutomatedJourneyForm(name) {
  return (
    name === JOURNEY_FORM_PREFIX ||
    name.startsWith(`${JOURNEY_FORM_PREFIX} `) ||
    name.startsWith(`${JOURNEY_FORM_PREFIX}(`)
  );
}

export function parseJourneyIdentity(name) {
  if (!name.startsWith(`${JOURNEY_FORM_PREFIX} `)) return null;
  const rest = name.slice(JOURNEY_FORM_PREFIX.length + 1);
  const splitAt = rest.indexOf(" ");
  const runId = splitAt === -1 ? rest : rest.slice(0, splitAt);
  const suffix = splitAt === -1 ? "" : rest.slice(splitAt + 1);
  if (!RUN_ID_PATTERN.test(runId) || !JOURNEY_SUFFIXES.includes(suffix)) return null;
  return { runId, suffix };
}

export function expectedPeriodLabel(identity) {
  return identity.suffix ? `E2E ${identity.runId} ${identity.suffix}` : `E2E ${identity.runId}`;
}

export function planE2eCleanup(snapshot) {
  const forms = snapshot.forms ?? [];
  const cycles = snapshot.cycles ?? [];
  const users = snapshot.users ?? [];
  const axes = snapshot.axes ?? [];
  const organizations = snapshot.organizations ?? [];
  const blockers = [];

  if (!forms.some((form) => form.name === CATALOG_FORM_NAME)) {
    blockers.push("O catálogo de critérios não apareceu na leitura.");
  }

  const provenForms = [];
  const uncertainForms = [];
  const permanentForms = [];

  for (const form of forms) {
    const identity = parseJourneyIdentity(form.name);
    const formCycles = cycles.filter((cycle) => cycle.formId === form.id);
    if (form.name === CATALOG_FORM_NAME) {
      permanentForms.push(form);
      continue;
    }
    if (!isAutomatedJourneyForm(form.name)) {
      blockers.push(`Formulário não reconhecido: ${form.name}.`);
      permanentForms.push(form);
      continue;
    }
    const proven = identity
      ? corroborateJourney(form, identity, formCycles, blockers)
      : null;
    if (proven) provenForms.push(proven);
    else {
      const eligibility = collectionDeleteEligibility(form, formCycles);
      uncertainForms.push({
        ...presentForm(form, formCycles),
        motivo: uncertainReason(identity, formCycles),
        elegibilidade: {
          ...eligibility,
          elegivel: false,
          motivo: `${eligibility.motivo} A identificação não autoriza a limpeza.`,
        },
      });
    }
  }

  const provenFormIds = new Set(provenForms.map((form) => form.id));
  const uncertainFormIds = new Set(uncertainForms.map((form) => form.id));
  const provenCycles = cycles.filter((cycle) => provenFormIds.has(cycle.formId));
  const uncertainCycles = cycles.filter((cycle) => uncertainFormIds.has(cycle.formId));

  for (const org of organizations) {
    if (!PERMANENT_ORGS.includes(org.name)) {
      blockers.push(`Organização inesperada: ${org.name}.`);
    }
  }
  for (const axis of axes) {
    if (!PERMANENT_AXES.includes(axis)) blockers.push(`Eixo inesperado: ${axis}.`);
  }

  const provenCycleIds = new Set(provenCycles.map((cycle) => cycle.id));
  const uncertainCycleIds = new Set(uncertainCycles.map((cycle) => cycle.id));
  const storage = splitStorage(snapshot, provenCycleIds, uncertainCycleIds);
  if (storage.compartilhados.length > 0) {
    blockers.push("Há arquivo de Storage compartilhado com registro fora da seleção comprovada.");
  }

  const provenRecordIds = recordIds(provenForms, provenCycles, snapshot);
  const uncertainRecordIds = recordIds(uncertainForms, uncertainCycles, snapshot);
  const auditHits = snapshot.auditLogs ?? [];

  return {
    execute: false,
    exclusaoRemota: "bloqueada",
    ordemProposta: SAFE_CLEANUP_ORDER,
    ordemSegura: SAFE_CLEANUP_ORDER,
    auditoria: "preservada",
    blockers,
    comprovados: {
      forms: provenForms,
      cycles: provenCycles.map(presentCycle),
      quantidades: { ...countLinked(provenCycles, snapshot), formularios: provenForms.length },
      storage: {
        exclusivos: storage.exclusivos,
        compartilhados: storage.compartilhados,
      },
      auditLogsPreservados: countAudit(auditHits, provenRecordIds),
    },
    incertos: {
      forms: uncertainForms,
      cycles: uncertainCycles.map(presentCycle),
      quantidades: {
        ...countLinked(uncertainCycles, snapshot),
        formularios: uncertainForms.length,
      },
      storage: storage.incertos,
      auditLogsPreservados: countAudit(auditHits, uncertainRecordIds),
    },
    naoExcluiveisPelaRegraAtual: provenForms
      .filter((form) => !form.elegibilidade.elegivel)
      .map((form) => ({
        id: form.id,
        name: form.name,
        motivo: form.elegibilidade.motivo,
      })),
    preservados: {
      forms: permanentForms.map((form) => form.name),
      cycles: cycles
        .filter((cycle) => !provenFormIds.has(cycle.formId) && !uncertainFormIds.has(cycle.formId))
        .map((cycle) => cycle.id),
      users: users
        .filter((user) => PERMANENT_EMAILS.includes(user.email))
        .map((user) => user.email),
      organizations: organizations.map((org) => org.name),
      axes,
      contasForaDaBase: users
        .filter((user) => !PERMANENT_EMAILS.includes(user.email))
        .map((user) => ({
          email: user.email,
          motivo: userReferencedByAudit(user, auditHits)
            ? "A auditoria referencia a conta. Ela permanece."
            : "A conta está fora das cinco contas-base. A prévia não autoriza excluí-la.",
        })),
      auditLogsTotal: auditHits.length,
      libraryAuditEvents: snapshot.libraryAuditEvents ?? null,
    },
  };
}

function uncertainReason(identity, formCycles) {
  if (!identity) {
    return "O nome não traz o identificador gerado pela jornada junto com um período correspondente.";
  }
  if (formCycles.length === 0) {
    return "O nome tem identificador, mas não há período de ciclo para corroborar a execução.";
  }
  return "O nome tem identificador, mas o período ou o órgão não corrobora a execução.";
}

function corroborateJourney(form, identity, formCycles, blockers) {
  const period = expectedPeriodLabel(identity);
  if (formCycles.length === 0) return null;
  const divergent = formCycles.some(
    (cycle) =>
      cycle.periodLabel !== period || !PERMANENT_ORGS.includes(cycle.organizationName),
  );
  if (divergent) {
    blockers.push(`A execução ${identity.runId} do formulário ${form.id} não ficou corroborada.`);
    return null;
  }
  return {
    ...presentForm(form, formCycles),
    runId: identity.runId,
    suffix: identity.suffix || null,
    elegibilidade: collectionDeleteEligibility(form, formCycles),
  };
}

export function collectionDeleteEligibility(form, formCycles) {
  const collecting = formCycles.filter((cycle) => COLLECTING_STATES.has(cycle.state));
  const fullySuspended =
    collecting.length > 0 &&
    collecting.every((cycle) => Boolean(cycle.responseCollectionPausedAt));
  if (!form.published && formCycles.length === 0) {
    return {
      operacao: "delete_unpublished_form",
      elegivel: true,
      motivo: "Formulário nunca publicado e sem ciclo. A prévia ainda não executa essa RPC.",
    };
  }
  if (fullySuspended) {
    return {
      operacao: "admin_delete_suspended_form",
      elegivel: true,
      motivo:
        "A coleta em preenchimento ou correção está pausada. A prévia ainda não executa essa RPC.",
    };
  }
  if (collecting.length === 0) {
    return {
      operacao: "admin_delete_suspended_form",
      elegivel: false,
      motivo:
        "Não há ciclo em preenchimento ou correção. A função do produto recusa a exclusão e a limpeza não muda o estado.",
    };
  }
  return {
    operacao: "admin_delete_suspended_form",
    elegivel: false,
    motivo:
      "Há ciclo em preenchimento ou correção sem pausa. A limpeza não suspende a coleta.",
  };
}

function presentForm(form, formCycles) {
  return {
    id: form.id,
    name: form.name,
    published: Boolean(form.published),
    elegibilidade: collectionDeleteEligibility(form, formCycles),
  };
}

function presentCycle(cycle) {
  return {
    id: cycle.id,
    state: cycle.state,
    periodLabel: cycle.periodLabel,
    organizationName: cycle.organizationName,
    formId: cycle.formId,
    responseCollectionPausedAt: cycle.responseCollectionPausedAt ?? null,
  };
}

function countLinked(selectedCycles, snapshot) {
  const cycleIds = new Set(selectedCycles.map((cycle) => cycle.id));
  const responses = (snapshot.responses ?? []).filter((row) => cycleIds.has(row.cycleId));
  const recommendations = (snapshot.recommendations ?? []).filter((row) =>
    cycleIds.has(row.cycleId),
  );
  const recommendationIds = new Set(recommendations.map((row) => row.id));
  const plans = (snapshot.plans ?? []).filter((row) => recommendationIds.has(row.recommendationId));
  const planIds = new Set(plans.map((row) => row.id));
  const evidences = (snapshot.evidences ?? []).filter((row) => cycleIds.has(row.cycleId));
  const documents = (snapshot.actionPlanDocuments ?? []).filter((row) => planIds.has(row.planId));
  return {
    formularios: new Set(selectedCycles.map((cycle) => cycle.formId)).size,
    ciclos: selectedCycles.length,
    respostas: responses.length,
    recomendacoes: recommendations.length,
    planos: plans.length,
    evidencias: evidences.length,
    acompanhamentos: (snapshot.progressUpdates ?? []).filter((row) => planIds.has(row.planId))
      .length,
    documentosPlanoSemArquivo: documents.filter((row) => !row.storagePath).length,
    pdfs: (snapshot.reports ?? []).filter((row) => cycleIds.has(row.cycleId) && row.filePath)
      .length,
    responseIds: responses.map((row) => row.id),
    recommendationIds: recommendations.map((row) => row.id),
    planIds: plans.map((row) => row.id),
  };
}

function splitStorage(snapshot, provenCycleIds, uncertainCycleIds) {
  const rows = [
    ...(snapshot.evidences ?? []).map((row) => ({
      bucket: "evidencias",
      path: row.storagePath,
      cycleId: row.cycleId,
    })),
    ...(snapshot.reports ?? []).map((row) => ({
      bucket: "relatorios",
      path: row.filePath,
      cycleId: row.cycleId,
    })),
    ...(snapshot.actionPlanDocuments ?? []).map((row) => ({
      bucket: "planos-acao",
      path: row.storagePath,
      cycleId: row.cycleId,
    })),
    ...(snapshot.pendingEvidenceUploads ?? []).map((row) => ({
      bucket: "evidencias",
      path: row.storagePath,
      cycleId: row.cycleId,
    })),
    ...(snapshot.pendingActionPlanUploads ?? []).map((row) => ({
      bucket: "planos-acao",
      path: row.storagePath,
      cycleId: row.cycleId,
    })),
  ].filter((row) => row.path);
  const onProven = new Map();
  const onUncertain = [];
  const onPreserved = new Set();
  for (const row of rows) {
    const key = `${row.bucket}:${row.path}`;
    if (provenCycleIds.has(row.cycleId)) onProven.set(key, { bucket: row.bucket, path: row.path });
    else if (uncertainCycleIds.has(row.cycleId)) onUncertain.push(row);
    else onPreserved.add(key);
  }
  const compartilhados = [];
  const exclusivos = [];
  for (const [key, value] of onProven) {
    if (onPreserved.has(key) || onUncertain.some((row) => `${row.bucket}:${row.path}` === key)) {
      compartilhados.push(value);
    } else exclusivos.push(value);
  }
  const incertos = [];
  for (const row of onUncertain) {
    const key = `${row.bucket}:${row.path}`;
    if (onPreserved.has(key) || onProven.has(key)) compartilhados.push({ bucket: row.bucket, path: row.path });
    else incertos.push({ bucket: row.bucket, path: row.path, cycleId: row.cycleId });
  }
  return { exclusivos, compartilhados: dedupeBucketPaths(compartilhados), incertos: dedupePaths(incertos) };
}

function dedupeBucketPaths(rows) {
  const seen = new Set();
  const unique = [];
  for (const row of rows) {
    const key = `${row.bucket}:${row.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

function dedupePaths(rows) {
  const seen = new Set();
  const unique = [];
  for (const row of rows) {
    const key = `${row.bucket}:${row.path}:${row.cycleId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

function recordIds(forms, cycles, snapshot) {
  const cycleIds = new Set(cycles.map((cycle) => cycle.id));
  const responseIds = (snapshot.responses ?? [])
    .filter((row) => cycleIds.has(row.cycleId))
    .map((row) => row.id);
  const recommendationIds = (snapshot.recommendations ?? [])
    .filter((row) => cycleIds.has(row.cycleId))
    .map((row) => row.id);
  const recommendationIdSet = new Set(recommendationIds);
  const planIds = (snapshot.plans ?? [])
    .filter((row) => recommendationIdSet.has(row.recommendationId))
    .map((row) => row.id);
  return new Set([...forms.map((form) => form.id), ...cycleIds, ...responseIds, ...recommendationIds, ...planIds]);
}

function countAudit(auditHits, recordIds) {
  return auditHits.filter((hit) => recordIds.has(hit.recordId)).length;
}

function userReferencedByAudit(user, auditHits) {
  if (!user.id) return false;
  return auditHits.some((hit) => hit.actorUserId === user.id || hit.recordId === user.id);
}
