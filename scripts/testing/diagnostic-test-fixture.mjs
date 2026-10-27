#!/usr/bin/env node
/**
 * Instala a fixture SQL do Diagnóstico de Integridade 2026 em um destino
 * autorizado: Supabase local na porta 54322 ou o projeto de homologação
 * depois que a verificação de destino confirma que não é o projeto oficial.
 *
 * A fixture não pertence à baseline de produção. Este módulo existe para que
 * DB integration e E2E possam testá-la sem contaminar o schema canônico usado
 * por `check:generated-types`.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";
import { prepareWritableEnvironment } from "../shared/writable-target.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const localSupabaseDbUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export async function installDiagnosticTestFixture() {
  if (process.env.ORIENTA_TARGET?.trim() === "local" && !process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) {
    process.env.DATABASE_URL = localSupabaseDbUrl;
  }
  prepareWritableEnvironment();
  const databaseUrl = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("A conexão Postgres do destino autorizado está ausente.");
  }

  const fixturePath = resolve(
    root,
    "supabase/testing/fixtures/bootstrap_diagnostico_integridade_2026.sql",
  );
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(readFileSync(fixturePath, "utf8"));
    await client.query("notify pgrst, 'reload schema'");
  } finally {
    await client.end();
  }
}

const invokedAsScript = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (invokedAsScript) {
  installDiagnosticTestFixture()
    .then(() => console.log("Fixture de diagnóstico instalada no Supabase local."))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
