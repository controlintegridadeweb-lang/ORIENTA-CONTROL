#!/usr/bin/env node
/**
 * Prepara dados mínimos e determinísticos para a suíte E2E local.
 *
 * Não é usado em produção. Requer uma stack Supabase local recém-resetada e
 * variáveis NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { createServiceRoleSupabaseClient } from "../shared/create-service-role-supabase-client.mjs";
import { loadEnv } from "../shared/load-env.mjs";
import { installDiagnosticTestFixture } from "./diagnostic-test-fixture.mjs";

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin.e2e@orienta.local";
const respondentEmail = process.env.E2E_RESPONDENT_EMAIL ?? "respondente.e2e@orienta.local";
const outsiderEmail = process.env.E2E_OUTSIDER_EMAIL ?? "respondente.externo.e2e@orienta.local";
const password = process.env.E2E_PASSWORD ?? "OrientaE2E!2026";
const organizationName = process.env.E2E_ORGANIZATION_NAME ?? "Órgão de Teste E2E";
const organizationAcronym = process.env.E2E_ORGANIZATION_ACRONYM ?? "E2E";
const outsiderOrganizationName =
  process.env.E2E_OUTSIDER_ORGANIZATION_NAME ?? "Órgão Externo E2E";
const outsiderOrganizationAcronym = process.env.E2E_OUTSIDER_ORGANIZATION_ACRONYM ?? "E2X";

const supabase = createServiceRoleSupabaseClient();

async function applyDiagnosticTestFixture() {
  await installDiagnosticTestFixture();
  await waitForPostgrestRpc("bootstrap_diagnostico_integridade_2026");
}

async function waitForPostgrestRpc(functionName) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para confirmar o schema cache do PostgREST.",
    );
  }

  const endpoint = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${functionName}`;
  const maxAttempts = 20;
  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        p_actor_user_id: "00000000-0000-0000-0000-000000000000",
      }),
    });
    lastStatus = response.status;
    lastBody = await response.text();
    const missingFromCache =
      lastStatus === 404 || lastBody.includes("PGRST202") || lastBody.includes("schema cache");
    if (!missingFromCache) {
      return;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }

  throw new Error(
    `PostgREST não publicou ${functionName} após ${maxAttempts} tentativas. Última resposta: HTTP ${lastStatus} ${lastBody.slice(0, 400)}`,
  );
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

async function ensureUser({ email, fullName }) {
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

async function ensureRespondentProfile({ adminId, user, fullName, organizationId }) {
  const { data: existingProfile, error: profileReadError } = await supabase
    .from("profiles")
    .select("user_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileReadError) throw profileReadError;

  if (!existingProfile) {
    const { error } = await supabase.from("profiles").insert({
      user_id: user.id,
      role: "respondent",
      organization_id: organizationId,
      full_name: fullName,
    });
    if (error) throw error;
    return;
  }

  if (existingProfile.role !== "respondent") {
    throw new Error(`A conta E2E ${user.email ?? user.id} já existe com papel incompatível.`);
  }

  const { error } = await supabase.rpc("update_respondent_profile", {
    p_target_user_id: user.id,
    p_full_name: fullName,
    p_organization_id: organizationId,
    p_actor_user_id: adminId,
  });
  if (error) throw error;
}

async function ensureOrganization(name, acronym) {
  const { data, error } = await supabase
    .from("organizations")
    .upsert({ name, acronym }, { onConflict: "name" })
    .select("id,name")
    .single();
  if (error || !data) throw error ?? new Error(`Falha ao preparar organização ${name}.`);
  return data;
}

async function main() {
  await applyDiagnosticTestFixture();

  const admin = await ensureUser({ email: adminEmail, fullName: "Administração E2E" });
  const respondent = await ensureUser({ email: respondentEmail, fullName: "Respondente E2E" });
  const outsider = await ensureUser({ email: outsiderEmail, fullName: "Respondente Externo E2E" });

  const { error: adminError } = await supabase.rpc("bootstrap_global_admin", {
    p_user_id: admin.id,
    p_full_name: "Administração E2E",
  });
  if (adminError) throw adminError;

  const organization = await ensureOrganization(organizationName, organizationAcronym);
  const outsiderOrganization = await ensureOrganization(
    outsiderOrganizationName,
    outsiderOrganizationAcronym,
  );

  await ensureRespondentProfile({
    adminId: admin.id,
    user: respondent,
    fullName: "Respondente E2E",
    organizationId: organization.id,
  });
  await ensureRespondentProfile({
    adminId: admin.id,
    user: outsider,
    fullName: "Respondente Externo E2E",
    organizationId: outsiderOrganization.id,
  });

  // O catálogo oficial fornece eixos e seções para o wizard de criação de formulário.
  const { error: bootstrapError } = await supabase.rpc("bootstrap_diagnostico_integridade_2026", {
    p_actor_user_id: admin.id,
  });
  if (bootstrapError) throw bootstrapError;

  // Garante que o provider de e-mail aceita password grant com a anon key
  // (falha cedo se [auth.email].enable_signup desligar o provider no CLI).
  loadEnv();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!anonKey || !url) {
    throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL e/ou NEXT_PUBLIC_SUPABASE_ANON_KEY para validar o login E2E.");
  }
  const anonClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: loginProbeError } = await anonClient.auth.signInWithPassword({
    email: adminEmail,
    password,
  });
  if (loginProbeError) {
    throw new Error(
      `Login E2E (anon) rejeitado para ${adminEmail}: ${loginProbeError.message}` +
        (loginProbeError.code ? ` [${loginProbeError.code}]` : ""),
    );
  }
  await anonClient.auth.signOut();

  console.log(
    JSON.stringify(
      {
        adminEmail,
        respondentEmail,
        outsiderEmail,
        organizationName,
        outsiderOrganizationName,
        loginProbe: "ok",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
