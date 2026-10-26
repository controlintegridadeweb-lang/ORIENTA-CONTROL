#!/usr/bin/env node
/**
 * Confere os dados fictícios permanentes da homologação.
 * Não renomeia nem apaga formulários de execuções anteriores.
 * Cada jornada usa um nome próprio, com o identificador da execução.
 */
import { createClient } from "@supabase/supabase-js";
import { prepareWritableEnvironment } from "../shared/writable-target.mjs";

const JOURNEY_FORM_PREFIX = "Diagnóstico E2E - Jornada Canônica";
const CATALOG_FORM_NAME = "Diagnóstico de Integridade 2026";
const EXPECTED_AXES = ["Ambiental", "Governanca", "Social"];
const EXPECTED_ORGS = ["Órgão de Teste E2E", "Órgão Externo E2E"];
const EXPECTED_EMAILS = [
  "admin.e2e@orienta.local",
  "respondente.e2e@orienta.local",
  "suplente.alfa@orienta.test",
  "respondente.externo.e2e@orienta.local",
  "suplente.beta@orienta.test",
];

try {
  process.env.ORIENTA_TARGET = "homologacao";
  const identity = prepareWritableEnvironment();
  if (identity.projectRef !== "fqexokfsjadrbrvcsfax") {
    throw new Error("Destino diferente do projeto de homologação autorizado.");
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const summary = await inspect(supabase);
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function inspect(supabase) {
  const axes = await names(supabase, "axes", "name");
  const organizations = await names(supabase, "organizations", "name");
  const emails = await userEmails(supabase);
  const catalogCount = await catalogQuestionCount(supabase);
  const forms = await names(supabase, "forms", "name");
  const appointments = await names(supabase, "respondent_profile_details", "appointment");
  const { count: cycles, error: cycleError } = await supabase
    .from("cycles")
    .select("id", { count: "exact", head: true });
  if (cycleError) throw new Error(cycleError.message);

  const missingAxes = EXPECTED_AXES.filter((name) => !axes.includes(name));
  const missingOrgs = EXPECTED_ORGS.filter((name) => !organizations.includes(name));
  const missingEmails = EXPECTED_EMAILS.filter((email) => !emails.includes(email));
  if (missingAxes.length || missingOrgs.length || missingEmails.length || catalogCount !== 126) {
    throw new Error(
      `Preparação incompleta. Eixos ausentes: ${missingAxes.join(", ") || "nenhum"}. Órgãos ausentes: ${missingOrgs.join(", ") || "nenhum"}. Contas ausentes: ${missingEmails.join(", ") || "nenhuma"}. Critérios do catálogo: ${catalogCount}.`,
    );
  }

  return {
    projeto: "fqexokfsjadrbrvcsfax",
    eixos: axes.sort(),
    orgaos: organizations.sort(),
    contas: emails.filter((email) => EXPECTED_EMAILS.includes(email)).sort(),
    nomeacoes: appointments.sort(),
    formularios: forms.sort(),
    criteriosCatalogo: catalogCount,
    ciclos: cycles ?? 0,
    formulariosDeJornada: forms.filter(
      (name) =>
        name === JOURNEY_FORM_PREFIX ||
        name.startsWith(`${JOURNEY_FORM_PREFIX} `) ||
        name.startsWith(`${JOURNEY_FORM_PREFIX}(`),
    ),
  };
}

async function names(supabase, table, column) {
  const { data, error } = await supabase.from(table).select(column);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row[column]);
}

async function userEmails(supabase) {
  const emails = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    emails.push(...users.map((user) => user.email?.toLowerCase()).filter(Boolean));
    if (users.length < 200) break;
  }
  return emails;
}

async function catalogQuestionCount(supabase) {
  const { data: form, error: formError } = await supabase
    .from("forms")
    .select("id")
    .eq("name", CATALOG_FORM_NAME)
    .maybeSingle();
  if (formError) throw new Error(formError.message);
  if (!form) return 0;
  const { data: draft, error: draftError } = await supabase
    .from("form_drafts")
    .select("id")
    .eq("form_id", form.id)
    .maybeSingle();
  if (draftError) throw new Error(draftError.message);
  if (!draft) return 0;
  const { count, error } = await supabase
    .from("form_draft_questions")
    .select("question_id", { count: "exact", head: true })
    .eq("form_draft_id", draft.id);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

