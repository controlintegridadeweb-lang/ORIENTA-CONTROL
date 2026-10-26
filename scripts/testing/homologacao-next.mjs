/**
 * Ambiente do Next de homologação.
 * As chaves já definidas pela homologação prevalecem. Chaves de identidade
 * que existem só no .env.local ficam vazias para o Next não preenchê-las.
 */
import { createConnection } from "node:net";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { prepareWritableEnvironment, publicTargetSummary } from "../shared/writable-target.mjs";
import { readIsolatedEnv } from "../shared/load-env.mjs";

export const BUILD_MARKER = ".next/orienta-homologacao-ref";

export const OFFICIAL_ENV_BLOCKED_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "SUPABASE_DB_URL",
  "POSTGRES_URL",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
];

const SCANNED_EXTENSIONS = new Set([".js", ".json", ".html", ".rsc"]);

export function childEnvForHomologacaoNext(baseEnv, homologacaoFile, officialFile) {
  const env = { ...baseEnv };
  for (const key of OFFICIAL_ENV_BLOCKED_KEYS) {
    const homologacaoValue = String(homologacaoFile?.[key] ?? "").trim();
    const officialValue = String(officialFile?.[key] ?? "").trim();
    if (homologacaoValue) {
      if (officialValue && homologacaoValue === officialValue) {
        throw new Error(`${key} de homologação repete o valor do .env.local.`);
      }
      env[key] = homologacaoValue;
      continue;
    }
    if (officialValue) env[key] = "";
  }
  return env;
}

export function assertHomologacaoAppPort(appUrl) {
  let parsed;
  try {
    parsed = new URL(appUrl ?? "");
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL de homologação é inválida.");
  }
  const localHost = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (!localHost || parsed.port !== "3003") {
    throw new Error(
      "A aplicação de homologação precisa usar http://127.0.0.1:3003 ou http://localhost:3003.",
    );
  }
}

export function loadHomologacaoNextEnv() {
  process.env.ORIENTA_TARGET = "homologacao";
  const identity = prepareWritableEnvironment();
  assertHomologacaoAppPort(process.env.NEXT_PUBLIC_APP_URL);
  const homologacaoFile = readIsolatedEnv(".env.homologacao.local");
  const officialFile = readIsolatedEnv(".env.local");
  const env = childEnvForHomologacaoNext(process.env, homologacaoFile, officialFile);
  const summary = publicTargetSummary(env);
  // O Next da jornada fala com Auth, API e Storage. A senha do Postgres e o
  // token da Management API não entram no processo, e o valor vazio impede
  // que o .env.local preencha essas chaves.
  for (const key of [
    "DATABASE_URL",
    "SUPABASE_DB_URL",
    "POSTGRES_URL",
    "SUPABASE_ACCESS_TOKEN",
    "SUPABASE_DB_PASSWORD",
  ]) {
    env[key] = "";
  }
  env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3003";
  env.PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3003";
  return {
    identity,
    summary,
    env,
    productionRef: String(homologacaoFile?.ORIENTA_PRODUCTION_PROJECT_REF ?? "").trim(),
  };
}

export function portIsOpen(port, host = "127.0.0.1") {
  return new Promise((resolvePort) => {
    const socket = createConnection({ port, host });
    const finish = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolvePort(open);
    };
    socket.setTimeout(1000);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

export function findRefInDirectory(directory, ref) {
  const hits = [];
  if (!ref) return hits;
  walk(directory, ref, hits);
  return hits;
}

function walk(directory, ref, hits) {
  let entries = [];
  try {
    entries = readdirSync(directory);
  } catch {
    return;
  }
  for (const name of entries) {
    if (hits.length >= 5) return;
    const path = join(directory, name);
    let stats;
    try {
      stats = statSync(path);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      if (name === "cache") continue;
      walk(path, ref, hits);
      continue;
    }
    const dot = name.lastIndexOf(".");
    const extension = dot >= 0 ? name.slice(dot) : "";
    if (!SCANNED_EXTENSIONS.has(extension) || stats.size > 8_000_000) continue;
    const text = readFileSync(path, "utf8");
    if (text.includes(ref)) hits.push(path);
  }
}

export function markerPath(root) {
  return resolve(root, BUILD_MARKER);
}
