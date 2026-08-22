#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServiceRoleSupabaseClient } from "../shared/create-service-role-supabase-client.mjs";
import { loadEnv } from "../shared/load-env.mjs";
import {
  credentialPasswordResolver,
  emailDeliveryWarning,
  generateTemporaryPassword,
  normalizeOrganizationName,
  parseRespondentCredentials,
  parseRespondentSeed,
  resolvePasswordFactory,
  serializeCredentials,
} from "../imports/lib/respondent-seed.mjs";

loadEnv();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const defaultSeed = path.join(root, "supabase/seeds/respondent_accounts.csv");
const defaultCredentialOutput = path.join(root, "var/bootstrap/respondent-credentials.csv");

function usage() {
  console.log(`Uso:
  npm run bootstrap:respondents -- --file <respondentes.csv> [opções]

Opções:
  --dry-run                         valida e planeja sem escrever
  --verify-only                     valida a existência/vínculo das contas no destino
  --password-mode unique|fixed|file padrão: unique
  --password-env <NOME>             variável usada no modo fixed
  --credentials-in <arquivo.csv>    credenciais fortes no modo file
  --credentials-out <arquivo.csv>   saída de senhas criadas/redefinidas
  --reset-existing-passwords        redefine senha de contas Auth existentes
  --strict-email-deliverability     transforma alertas de entregabilidade em erro
  --help`);
}

function parseArgs(argv) {
  const out = { flags: new Set() };
  const booleanFlags = new Set([
    "dry-run",
    "verify-only",
    "reset-existing-passwords",
    "strict-email-deliverability",
  ]);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true, flags: out.flags };
    if (!arg.startsWith("--")) throw new Error(`Argumento inválido: ${arg}`);
    const [key, inline] = arg.slice(2).split("=", 2);
    if (booleanFlags.has(key)) {
      out.flags.add(key);
      continue;
    }
    const value = inline ?? argv[++i];
    if (value == null || value.startsWith("--")) throw new Error(`Informe um valor para --${key}.`);
    out[key] = value;
  }
  return out;
}

async function listAllAuthUsers(client) {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

function createPasswordResolver(args, respondents) {
  const mode = args["password-mode"] ?? "unique";
  if (mode === "file") {
    const input = args["credentials-in"];
    if (!input) throw new Error("--password-mode file exige --credentials-in.");
    const credentials = parseRespondentCredentials(fs.readFileSync(path.resolve(input), "utf8"));
    return credentialPasswordResolver(credentials, respondents);
  }
  if (mode === "fixed") {
    const envName = args["password-env"] ?? "ORIENTA_BOOTSTRAP_RESPONDENT_PASSWORD";
    return resolvePasswordFactory({ mode, fixedPassword: process.env[envName] });
  }
  if (mode !== "unique") throw new Error("--password-mode deve ser unique, fixed ou file.");
  return () => generateTemporaryPassword();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return usage();
  const seedPath = path.resolve(args.file ?? defaultSeed);
  const respondents = parseRespondentSeed(fs.readFileSync(seedPath, "utf8"));
  const strict = args.flags.has("strict-email-deliverability");
  const warnings = respondents.flatMap((item) => {
    const warning = emailDeliveryWarning(item.email);
    return warning ? [{ item, warning }] : [];
  });
  if (strict && warnings.length) {
    throw new Error(`Há ${warnings.length} e-mail(s) com alerta de entregabilidade; revise a fonte antes da carga.`);
  }
  for (const { item, warning } of warnings) console.warn(`⚠ ${item.organizationAcronym}: ${warning}.`);

  const client = createServiceRoleSupabaseClient();
  const [{ data: admins, error: adminError }, { data: organizations, error: orgError }, authUsers] = await Promise.all([
    client.from("profiles").select("user_id").eq("role", "admin"),
    client.from("organizations").select("id,name,acronym"),
    listAllAuthUsers(client),
  ]);
  if (adminError) throw adminError;
  if (orgError) throw orgError;
  if ((admins ?? []).length !== 1) throw new Error("A carga exige exatamente um administrador global.");
  const actorUserId = admins[0].user_id;
  const orgByAcronym = new Map((organizations ?? []).map((org) => [String(org.acronym).toUpperCase(), org]));
  const authByEmail = new Map(authUsers.filter((u) => u.email).map((u) => [u.email.toLowerCase(), u]));

  for (const respondent of respondents) {
    const org = orgByAcronym.get(respondent.organizationAcronym);
    if (!org) throw new Error(`Organização ${respondent.organizationAcronym} não encontrada.`);
    if (normalizeOrganizationName(org.name) !== normalizeOrganizationName(respondent.organizationName)) {
      throw new Error(`Nome divergente para ${respondent.organizationAcronym}: banco="${org.name}" CSV="${respondent.organizationName}".`);
    }
  }

  if (args.flags.has("verify-only")) {
    const userIds = authUsers.map((u) => u.id);
    const { data: profiles, error } = userIds.length
      ? await client.from("profiles").select("user_id,role,organization_id").in("user_id", userIds)
      : { data: [], error: null };
    if (error) throw error;
    const profileByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    const failures = [];
    for (const respondent of respondents) {
      const user = authByEmail.get(respondent.email);
      const org = orgByAcronym.get(respondent.organizationAcronym);
      const profile = user ? profileByUserId.get(user.id) : null;
      if (!user || !profile || profile.role !== "respondent" || profile.organization_id !== org.id) {
        failures.push(respondent.organizationAcronym);
      }
    }
    if (failures.length) throw new Error(`Verificação falhou para: ${failures.join(", ")}.`);
    console.log(`✓ ${respondents.length} respondente(s) verificados.`);
    return;
  }

  const resolvePassword = createPasswordResolver(args, respondents);
  const dryRun = args.flags.has("dry-run");
  const resetExisting = args.flags.has("reset-existing-passwords");
  const plan = respondents.map((respondent) => ({
    respondent,
    operation: authByEmail.has(respondent.email) ? (resetExisting ? "reset" : "keep") : "create",
  }));
  console.log(`Plano: ${plan.filter((x) => x.operation === "create").length} criar, ${plan.filter((x) => x.operation === "reset").length} redefinir, ${plan.filter((x) => x.operation === "keep").length} manter.`);
  if (dryRun) return;

  const credentialRows = [];
  for (const item of plan) {
    const { respondent } = item;
    const org = orgByAcronym.get(respondent.organizationAcronym);
    let user = authByEmail.get(respondent.email) ?? null;
    let created = false;
    let password = null;

    let existingProfile = null;
    if (user) {
      const { data, error } = await client
        .from("profiles")
        .select("role,organization_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      existingProfile = data;
      if (existingProfile && (existingProfile.role !== "respondent" || existingProfile.organization_id !== org.id)) {
        throw new Error(`Conta ${respondent.email} já existe com perfil ou organização incompatível.`);
      }
    }

    if (!user) {
      password = resolvePassword(respondent);
      const { data, error } = await client.auth.admin.createUser({
        email: respondent.email,
        password,
        email_confirm: true,
        user_metadata: respondent.fullName ? { full_name: respondent.fullName } : undefined,
      });
      if (error || !data.user) throw error ?? new Error(`Falha ao criar ${respondent.email}.`);
      user = data.user;
      created = true;
      authByEmail.set(respondent.email, user);
    }

    if (!existingProfile) {
      const { error } = await client.rpc("create_respondent_profile", {
        p_user_id: user.id,
        p_email: respondent.email,
        p_full_name: respondent.fullName,
        p_organization_id: org.id,
        p_actor_user_id: actorUserId,
      });
      if (error) {
        if (created) await client.auth.admin.deleteUser(user.id).catch(() => undefined);
        throw error;
      }
    }

    if (!created && resetExisting) {
      password = resolvePassword(respondent);
      const { error } = await client.auth.admin.updateUserById(user.id, { password });
      if (error) throw error;
    }

    if (password) {
      credentialRows.push({
        organizationAcronym: respondent.organizationAcronym,
        email: respondent.email,
        password,
        operation: created ? "created" : "password_reset",
      });
    }
  }

  if (credentialRows.length) {
    const output = path.resolve(args["credentials-out"] ?? defaultCredentialOutput);
    fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
    fs.writeFileSync(output, serializeCredentials(credentialRows), { mode: 0o600 });
    fs.chmodSync(output, 0o600);
    console.log(`✓ Credenciais temporárias gravadas em ${path.relative(root, output)} com permissão 0600.`);
  }
  console.log(`✓ Carga concluída: ${respondents.length} respondente(s).`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
