#!/usr/bin/env node
/**
 * Gera e valida os tipos do schema `public` com o Supabase CLI oficial.
 *
 * Uso:
 *   DATABASE_URL=postgresql://... npm run gen:types
 *   DATABASE_URL=postgresql://... npm run check:generated-types
 *
 * `check:generated-types` compara o contrato consumido pela aplicação
 * (tabelas, colunas, Insert/Update, views, RPCs, enums). Metadata interna
 * do gerador (Relationships, SetofOptions, PostgrestVersion) não falha o check.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, resolveDbUrl, supabaseProjectRef } from "../shared/load-env.mjs";
import { runSupabase } from "../shared/supabase-cli-path.mjs";
import {
  compareGeneratedTypeContracts,
  normalize,
} from "./generated-types-contract.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const target = resolve(root, "src/infrastructure/supabase/database.types.ts");
const generatedSnapshot = resolve(root, "var/database.generated.types.ts");
const checkOnly = process.argv.includes("--check");

if (process.argv.includes("--self-check")) {
  const source = readFileSync(target, "utf8");
  reportComparison(compareGeneratedTypeContracts(source, source, { root }));
  console.log("Auto-comparação do arquivo versionado passou.");
  process.exit(0);
}

loadEnv();
const databaseUrl = resolveDbUrl();
const projectRef = supabaseProjectRef();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const canUseProjectApi = Boolean(projectRef && accessToken);

if (!databaseUrl && !canUseProjectApi) {
  console.error(
    "Fonte do schema não definida. Informe SUPABASE_DB_URL/DATABASE_URL/POSTGRES_URL, ou SUPABASE_ACCESS_TOKEN + NEXT_PUBLIC_SUPABASE_URL do projeto.",
  );
  process.exit(2);
}

const result = generateTypesFromSchema({
  databaseUrl,
  projectRef,
  accessToken,
  canUseProjectApi,
});

if (result.status !== 0) {
  const stderr = result.stderr?.trim();
  console.error("Falha ao gerar tipos com o Supabase CLI.");
  if (stderr) console.error(stderr);
  process.exit(result.status ?? 1);
}

const generated = normalize(extractGeneratedTypes(result.stdout ?? ""));
if (
  !generated.includes("export type Database") &&
  !generated.includes("export interface Database")
) {
  console.error("A saída do Supabase CLI não contém o contrato Database esperado.");
  process.exit(1);
}

if (checkOnly) {
  mkdirSync(dirname(generatedSnapshot), { recursive: true });
  writeFileSync(generatedSnapshot, generated, "utf8");
  const comparison = compareGeneratedTypeContracts(
    readFileSync(target, "utf8"),
    generated,
    { root },
  );
  reportComparison(comparison);
  if (!comparison.ok) {
    mkdirSync(resolve(root, "var"), { recursive: true });
    writeFileSync(
      resolve(root, "var/database.current.canonical.ts"),
      readFileSync(target, "utf8"),
      "utf8",
    );
    console.error(
      "database.types.ts está incompatível com o schema real. Execute `npm run gen:types` e versione o resultado oficial.",
    );
    if (comparison.typecheck.output) console.error(comparison.typecheck.output);
    process.exit(1);
  }
  console.log("Tipos versionados estão estruturalmente sincronizados com o schema real.");
  process.exit(0);
}

writeFileSync(target, generated, "utf8");
console.log(`Tipos gerados pelo Supabase CLI: ${target}`);

function reportComparison(comparison) {
  const { current, generated: generatedContract, structuralDiffs } = comparison;
  console.log(
    `Contrato versionado: ${Object.keys(current.tables).length} tabelas, ${Object.keys(current.views).length} views, ${Object.keys(current.functions).length} funções, ${Object.keys(current.enums).length} enums.`,
  );
  console.log(
    `Contrato gerado: ${Object.keys(generatedContract.tables).length} tabelas, ${Object.keys(generatedContract.views).length} views, ${Object.keys(generatedContract.functions).length} funções, ${Object.keys(generatedContract.enums).length} enums.`,
  );
  if (structuralDiffs.length > 0) {
    console.error("Diferença estrutural entre database.types.ts e o schema gerado:");
    for (const line of structuralDiffs) console.error(`- ${line}`);
    return;
  }
  console.log("Chaves de Tables/Views/Functions/Enums coincidem; validando tipos canônicos.");
}

function isLocalSupabaseDbUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url.replace(/^postgresql:/i, "http:"));
    const localHost =
      parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
    return localHost && parsed.port === "54322";
  } catch {
    return false;
  }
}

function generateTypesFromSchema({
  databaseUrl,
  projectRef,
  accessToken,
  canUseProjectApi,
}) {
  const preferLocal =
    process.env.SUPABASE_GEN_TYPES_MODE === "local" ||
    isLocalSupabaseDbUrl(databaseUrl);

  const attempts = [];
  if (preferLocal) {
    attempts.push({
      label: "local",
      args: ["gen", "types", "typescript", "--local", "--schema", "public"],
    });
  }
  if (databaseUrl) {
    attempts.push({
      label: "db-url",
      args: [
        "gen",
        "types",
        "typescript",
        "--db-url",
        databaseUrl,
        "--schema",
        "public",
      ],
    });
  }
  if (canUseProjectApi) {
    attempts.push({
      label: "project-id",
      args: [
        "gen",
        "types",
        "typescript",
        "--project-id",
        projectRef,
        "--schema",
        "public",
      ],
    });
  }

  let last = { status: 1, stdout: "", stderr: "" };
  for (const attempt of attempts) {
    last = runSupabase(attempt.args, {
      cwd: root,
      stdio: "pipe",
      env: {
        ...process.env,
        ...(accessToken ? { SUPABASE_ACCESS_TOKEN: accessToken } : {}),
      },
    });
    if (last.status === 0) return last;
    const detail = (last.stderr || last.stdout || "").trim();
    if (detail && attempts.indexOf(attempt) < attempts.length - 1) {
      console.warn(`Fonte ${attempt.label} indisponível; tentando alternativa.`);
    } else if (detail) {
      console.error(detail.split("\n").slice(0, 12).join("\n"));
    }
  }
  return last;
}

function extractGeneratedTypes(stdout) {
  const marker = "export type Json";
  const idx = stdout.indexOf(marker);
  return idx >= 0 ? stdout.slice(idx) : stdout;
}
