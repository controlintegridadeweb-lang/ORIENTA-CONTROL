#!/usr/bin/env node
/**
 * Identidades fictícias e idempotentes da homologação.
 * Não cria respostas, recomendações, ações nem acompanhamentos:
 * esses registros nascem da jornada Playwright e dos verificadores SQL,
 * que passam pela máquina de estados do produto.
 */
import { createServiceRoleSupabaseClient } from "../shared/create-service-role-supabase-client.mjs";
import { prepareWritableEnvironment } from "../shared/writable-target.mjs";

const ADMIN_EMAIL = "admin.e2e@orienta.local";
const ORGS = {
  alfa: { name: "Órgão de Teste E2E", acronym: "E2E" },
  beta: { name: "Órgão Externo E2E", acronym: "E2X" },
};
const RESPONDENTS = [
  {
    email: "respondente.e2e@orienta.local",
    fullName: "Respondente E2E",
    organization: "alfa",
    appointment: "titular",
  },
  {
    email: "suplente.alfa@orienta.test",
    fullName: "Suplente Fictício Alfa",
    organization: "alfa",
    appointment: "suplente",
  },
  {
    email: "respondente.externo.e2e@orienta.local",
    fullName: "Respondente Externo E2E",
    organization: "beta",
    appointment: "titular",
  },
  {
    email: "suplente.beta@orienta.test",
    fullName: "Suplente Fictício Beta",
    organization: "beta",
    appointment: "suplente",
  },
];

const password = process.env.E2E_PASSWORD?.trim() || "OrientaE2E!2026";
let supabase;

async function main() {
  prepareWritableEnvironment();
  supabase = createServiceRoleSupabaseClient();
  const admin = await ensureUser(ADMIN_EMAIL, "Administração E2E");
  const { error: adminError } = await supabase.rpc("bootstrap_global_admin", {
    p_user_id: admin.id,
    p_full_name: "Administração E2E",
  });
  if (adminError) throw adminError;

  const organizations = {};
  for (const [key, org] of Object.entries(ORGS)) {
    organizations[key] = await ensureOrganization(org.name, org.acronym);
  }
  for (const respondent of RESPONDENTS) {
    const user = await ensureUser(respondent.email, respondent.fullName);
    await ensureRespondent({
      adminId: admin.id,
      user,
      fullName: respondent.fullName,
      organizationId: organizations[respondent.organization].id,
      appointment: respondent.appointment,
    });
  }

  console.log(
    JSON.stringify(
      {
        adminEmail: ADMIN_EMAIL,
        orgaos: Object.values(ORGS).map((org) => org.name),
        respondentes: RESPONDENTS.map((respondent) => ({
          email: respondent.email,
          appointment: respondent.appointment,
          orgao: ORGS[respondent.organization].name,
        })),
        diagnosticos: "produzidos pela jornada e2e e por supabase/verify",
        recomendacoes: "produzidos pela jornada e2e e por supabase/verify",
        acoes: "produzidos pela jornada e2e e por supabase/verify",
        acompanhamentos: "produzidos pela jornada e2e e por supabase/verify",
      },
      null,
      2,
    ),
  );
}

async function ensureUser(email, fullName) {
  const existing = await findUserByEmail(email);
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    return existing;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw error ?? new Error(`Falha ao criar ${email}.`);
  return data.user;
}

async function findUserByEmail(email) {
  const needle = email.toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users ?? [];
    const found = users.find((user) => user.email?.toLowerCase() === needle);
    if (found) return found;
    if (users.length < 200) return null;
  }
  return null;
}

async function ensureOrganization(name, acronym) {
  const { data: existing, error: readError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("name", name)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) return existing;
  const { data, error } = await supabase
    .from("organizations")
    .insert({ name, acronym })
    .select("id, name")
    .single();
  if (error || !data) throw error ?? new Error(`Falha ao criar ${name}.`);
  return data;
}

async function ensureRespondent({ adminId, user, fullName, organizationId, appointment }) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) throw profileError;

  if (!profile) {
    const { error } = await supabase.rpc("create_respondent_profile", {
      p_user_id: user.id,
      p_email: user.email,
      p_full_name: fullName,
      p_organization_id: organizationId,
      p_actor_user_id: adminId,
      p_appointment: appointment,
    });
    if (error) throw error;
    return;
  }
  if (profile.role !== "respondent") {
    throw new Error(`A conta ${user.email ?? user.id} já existe com papel incompatível.`);
  }
  const { error } = await supabase.rpc("update_respondent_profile", {
    p_target_user_id: user.id,
    p_full_name: fullName,
    p_organization_id: organizationId,
    p_actor_user_id: adminId,
    p_appointment: appointment,
  });
  if (error) throw error;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
