#!/usr/bin/env node
import { createServiceRoleSupabaseClient } from "../shared/create-service-role-supabase-client.mjs";
import { loadEnv } from "../shared/load-env.mjs";
import { isWeakPassword } from "../imports/lib/respondent-seed.mjs";

loadEnv();

function usage() {
  console.log(`Uso:
  npm run bootstrap:admin -- --email <email> --password <senha> [--name <nome>]

Cria ou promove, de forma idempotente, o único administrador global do ORIENTA.`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (!arg.startsWith("--")) throw new Error(`Argumento inválido: ${arg}`);
    const [rawKey, inline] = arg.slice(2).split("=", 2);
    const value = inline ?? argv[++i];
    if (value == null || value.startsWith("--")) throw new Error(`Informe um valor para --${rawKey}.`);
    out[rawKey] = value;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return usage();
  const email = String(args.email ?? "").trim().toLowerCase();
  const password = String(args.password ?? "");
  const fullName = String(args.name ?? "").trim() || null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Informe --email válido.");
  if (isWeakPassword(password)) {
    throw new Error("A senha deve ter ao menos 12 caracteres com maiúscula, minúscula, número e símbolo.");
  }

  const client = createServiceRoleSupabaseClient();
  const { data: admins, error: adminError } = await client
    .from("profiles")
    .select("user_id")
    .eq("role", "admin");
  if (adminError) throw adminError;
  if ((admins ?? []).length > 1) throw new Error("Estado inválido: existe mais de um administrador global.");

  const users = await listAllAuthUsers(client);
  let user = users.find((item) => item.email?.toLowerCase() === email) ?? null;
  let created = false;

  if (admins?.[0] && admins[0].user_id !== user?.id) {
    throw new Error("Já existe um administrador global diferente. O bootstrap não cria nem promove um segundo administrador.");
  }

  if (!user) {
    const { data, error } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    });
    if (error || !data.user) throw error ?? new Error("Falha ao criar usuário Auth do administrador.");
    user = data.user;
    created = true;
  } else {
    const { data: existingProfile, error: profileLookupError } = await client
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileLookupError) throw profileLookupError;
    if (existingProfile && existingProfile.role !== "admin") {
      throw new Error(
        "A conta informada já possui perfil de respondente. O bootstrap não altera a identidade de um usuário existente para administrador.",
      );
    }
  }

  const { error: profileError } = await client.rpc("bootstrap_global_admin", {
    p_user_id: user.id,
    p_full_name: fullName,
  });
  if (profileError) {
    if (created) await client.auth.admin.deleteUser(user.id).catch(() => undefined);
    throw profileError;
  }

  console.log(created ? "✓ Administrador global criado." : "✓ Administrador global confirmado/promovido.");
  console.log(`  user_id: ${user.id}`);
  console.log(`  email: ${email}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
