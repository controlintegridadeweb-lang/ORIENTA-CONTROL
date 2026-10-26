/**
 * Destino obrigatório dos testes que escrevem.
 * Produção nunca é aceita. Não existe opção para desligar esta verificação.
 */
import { loadEnv, readIsolatedEnv } from "./load-env.mjs";

export { readIsolatedEnv };

const PROJECT_REF = /^[a-z0-9]{20}$/;
const DISABLE_FLAGS = [
  "ORIENTA_SKIP_TARGET_CHECK",
  "SKIP_TARGET_CHECK",
  "ORIENTA_ALLOW_PRODUCTION",
  "ORIENTA_DISABLE_TARGET_GUARD",
];
const HOMOLOGACAO_FILE = ".env.homologacao.local";
const HOMOLOGACAO_REQUIRED = [
  "ORIENTA_TARGET",
  "ORIENTA_HOMOLOGACAO_PROJECT_REF",
  "ORIENTA_PRODUCTION_PROJECT_REF",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
];

export function projectRefFromSupabaseUrl(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("A URL do Supabase é inválida.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("A URL do Supabase não pode conter credenciais.");
  }
  const match = parsed.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/);
  return match?.[1] ?? null;
}

export function projectRefFromDatabaseUrl(raw) {
  const value = String(raw ?? "").trim();
  if (!value) throw new Error("A conexão Postgres está vazia.");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Não foi possível ler a conexão Postgres.");
  }
  if (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") {
    throw new Error("A conexão Postgres de homologação não pode ser local.");
  }
  const user = decodeURIComponent(parsed.username);
  const fromUser = user.match(/^postgres\.([a-z0-9]{20})$/)?.[1] ?? null;
  const fromHost = parsed.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/)?.[1] ?? null;
  if (fromUser && fromHost && fromUser !== fromHost) {
    throw new Error("O usuário e o host do Postgres identificam projetos diferentes.");
  }
  const ref = fromUser || fromHost;
  if (!ref) {
    throw new Error(
      "A conexão Postgres não identifica o projeto. Use o usuário postgres.<ref> no pooler ou o host db.<ref>.supabase.co.",
    );
  }
  return ref;
}

function value(env, key) {
  return String(env[key] ?? "").trim();
}

function databaseUrls(env) {
  return ["SUPABASE_DB_URL", "DATABASE_URL", "POSTGRES_URL"]
    .map((key) => ({ key, url: value(env, key) }))
    .filter((entry) => entry.url);
}

function assertNoDisableFlag(env) {
  for (const flag of DISABLE_FLAGS) {
    if (value(env, flag)) {
      throw new Error(`A proteção de destino não pode ser desativada por ${flag}.`);
    }
  }
}

function assertLocalSupabaseUrl(raw) {
  if (!raw) return;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("A URL local do Supabase é inválida.");
  }
  if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    throw new Error("ORIENTA_TARGET=local recusou uma URL Supabase que não é localhost.");
  }
  if (parsed.hostname.endsWith("supabase.co") || raw.includes("supabase.co")) {
    throw new Error("ORIENTA_TARGET=local recusou um projeto supabase.co.");
  }
}

function assertLocalDatabase(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Não foi possível ler a conexão Postgres local.");
  }
  if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    throw new Error("ORIENTA_TARGET=local recusou um Postgres que não está em localhost.");
  }
  if (parsed.port !== "54322") {
    throw new Error("ORIENTA_TARGET=local só aceita o Postgres do Supabase na porta 54322.");
  }
}

function assertLocalTarget(env, destructive) {
  const urls = databaseUrls(env);
  if (urls.length === 0) throw new Error("A conexão Postgres local está ausente.");
  for (const entry of urls) assertLocalDatabase(entry.url);
  assertLocalSupabaseUrl(value(env, "NEXT_PUBLIC_SUPABASE_URL"));
  assertLocalSupabaseUrl(value(env, "SUPABASE_URL"));
  if (destructive && value(env, "ORIENTA_LOCAL_CONFIRM") !== "aplicar-local") {
    throw new Error("Operação destrutiva local bloqueada. Defina ORIENTA_LOCAL_CONFIRM=aplicar-local.");
  }
}

function productionRefFromFile(productionEnv) {
  if (!productionEnv) return null;
  return projectRefFromSupabaseUrl(productionEnv.NEXT_PUBLIC_SUPABASE_URL ?? "");
}

function assertHomologacaoTarget(env, { destructive, productionEnv }) {
  const homologacaoRef = value(env, "ORIENTA_HOMOLOGACAO_PROJECT_REF");
  const productionRef = value(env, "ORIENTA_PRODUCTION_PROJECT_REF");
  if (!PROJECT_REF.test(homologacaoRef)) {
    throw new Error("ORIENTA_HOMOLOGACAO_PROJECT_REF ausente ou inválido.");
  }
  if (!PROJECT_REF.test(productionRef)) {
    throw new Error("ORIENTA_PRODUCTION_PROJECT_REF ausente ou inválido.");
  }
  if (homologacaoRef === productionRef) {
    throw new Error("O projeto de homologação é o mesmo projeto declarado como oficial.");
  }

  const supabaseUrl = value(env, "NEXT_PUBLIC_SUPABASE_URL");
  let parsedUrl;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error("A URL do Supabase de homologação é inválida.");
  }
  if (parsedUrl.protocol !== "https:" || parsedUrl.pathname !== "/" || parsedUrl.search || parsedUrl.hash) {
    throw new Error("A URL de homologação precisa ser a origem HTTPS do projeto.");
  }
  const urlRef = projectRefFromSupabaseUrl(supabaseUrl);
  if (urlRef !== homologacaoRef) {
    throw new Error("A URL do Supabase não corresponde a ORIENTA_HOMOLOGACAO_PROJECT_REF.");
  }
  if (urlRef === productionRef) {
    throw new Error("A URL configurada é a do projeto oficial.");
  }

  const urls = databaseUrls(env);
  if (urls.length === 0) throw new Error("A conexão Postgres de homologação está ausente.");
  const databaseRefs = urls.map((entry) => projectRefFromDatabaseUrl(entry.url));
  if (databaseRefs.some((ref) => ref !== homologacaoRef)) {
    throw new Error("A conexão Postgres não corresponde a ORIENTA_HOMOLOGACAO_PROJECT_REF.");
  }
  if (databaseRefs.some((ref) => ref === productionRef)) {
    throw new Error("A conexão Postgres aponta para o projeto oficial.");
  }

  const anon = value(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRole = value(env, "SUPABASE_SERVICE_ROLE_KEY");
  if (!anon || !serviceRole) throw new Error("As chaves anon e service_role de homologação são obrigatórias.");
  if (anon === serviceRole) throw new Error("A chave service_role não pode repetir a chave anon.");

  const fileRef = productionRefFromFile(productionEnv);
  if (fileRef && fileRef === homologacaoRef) {
    throw new Error("O .env.local aponta para o mesmo projeto da homologação.");
  }
  if (fileRef && fileRef !== productionRef) {
    throw new Error("ORIENTA_PRODUCTION_PROJECT_REF não coincide com o projeto do .env.local.");
  }

  if (destructive && value(env, "ORIENTA_HOMOLOGACAO_CONFIRM") !== `aplicar-homologacao:${homologacaoRef}`) {
    throw new Error(
      `Operação destrutiva bloqueada. Defina ORIENTA_HOMOLOGACAO_CONFIRM=aplicar-homologacao:${homologacaoRef}.`,
    );
  }
}

export function assertWritableTarget(env, options = {}) {
  assertNoDisableFlag(env);
  const target = value(env, "ORIENTA_TARGET");
  if (target === "local") {
    assertLocalTarget(env, options.destructive === true);
    return { target, projectRef: null };
  }
  if (target === "homologacao") {
    assertHomologacaoTarget(env, {
      destructive: options.destructive === true,
      productionEnv: options.productionEnv ?? null,
    });
    return { target, projectRef: value(env, "ORIENTA_HOMOLOGACAO_PROJECT_REF") };
  }
  throw new Error(
    "Defina ORIENTA_TARGET=local ou ORIENTA_TARGET=homologacao. Produção não é destino de teste.",
  );
}

export function loadHomologacaoFile() {
  const parsed = readIsolatedEnv(HOMOLOGACAO_FILE);
  if (!parsed) {
    throw new Error(
      "Arquivo .env.homologacao.local ausente. Copie .env.homologacao.example e preencha somente na máquina local.",
    );
  }
  for (const key of HOMOLOGACAO_REQUIRED) {
    if (!String(parsed[key] ?? "").trim()) {
      throw new Error(`${key} ausente em .env.homologacao.local.`);
    }
  }
  if (!String(parsed.DATABASE_URL ?? "").trim() && !String(parsed.SUPABASE_DB_URL ?? "").trim()) {
    throw new Error("DATABASE_URL ou SUPABASE_DB_URL ausente em .env.homologacao.local.");
  }
  if (String(parsed.ORIENTA_TARGET).trim() !== "homologacao") {
    throw new Error("ORIENTA_TARGET em .env.homologacao.local precisa ser homologacao.");
  }
  for (const [key, fileValue] of Object.entries(parsed)) {
    process.env[key] = fileValue;
  }
  return parsed;
}

export function prepareWritableEnvironment(options = {}) {
  const hinted = value(process.env, "ORIENTA_TARGET");
  if (hinted === "homologacao") loadHomologacaoFile();
  else if (hinted === "local") loadEnv();
  else {
    throw new Error(
      "Defina ORIENTA_TARGET=local ou ORIENTA_TARGET=homologacao antes deste comando.",
    );
  }
  return assertWritableTarget(process.env, {
    destructive: options.destructive === true,
    productionEnv: readIsolatedEnv(".env.local"),
  });
}

export function assertResetConfirmation(env) {
  const ref = projectRefFromSupabaseUrl(value(env, "NEXT_PUBLIC_SUPABASE_URL"));
  if (!ref) throw new Error("Não foi possível identificar o projeto que o reset apagaria.");
  const expected = `reset:${ref}`;
  if (value(env, "ORIENTA_RESET_CONFIRM") !== expected) {
    throw new Error(`Reset bloqueado. Defina ORIENTA_RESET_CONFIRM=${expected} depois de conferir o projeto.`);
  }
  return ref;
}

export function publicTargetSummary(env) {
  const target = value(env, "ORIENTA_TARGET") || "indefinido";
  let supabaseHost = "ausente";
  try {
    const raw = value(env, "NEXT_PUBLIC_SUPABASE_URL");
    if (raw) supabaseHost = new URL(raw).host;
  } catch {
    supabaseHost = "invalido";
  }
  let databaseHost = "ausente";
  const database = databaseUrls(env)[0];
  if (database) {
    try {
      databaseHost = new URL(database.url).host;
    } catch {
      databaseHost = "invalido";
    }
  }
  return {
    target,
    supabaseHost,
    databaseHost,
    projectRef: value(env, "ORIENTA_HOMOLOGACAO_PROJECT_REF") || null,
  };
}
