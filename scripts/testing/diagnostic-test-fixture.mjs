#!/usr/bin/env node
/**
 * Instala a fixture SQL do Diagnóstico de Integridade 2026 exclusivamente em
 * um PostgreSQL/Supabase local descartável.
 *
 * A fixture não pertence à baseline de produção. Este módulo existe para que
 * DB integration e E2E possam testá-la sem contaminar o schema canônico usado
 * por `check:generated-types`.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";
import { loadEnv, resolveDbUrl } from "../shared/load-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const localSupabaseDbUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export async function installDiagnosticTestFixture() {
  loadEnv();
  const databaseUrl = resolveDbUrl() ?? localSupabaseDbUrl;
  assertLocalDatabase(databaseUrl);

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

function assertLocalDatabase(databaseUrl) {
  const parsed = new URL(databaseUrl.replace(/^postgresql:/i, "http:"));
  const localHost = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (!localHost || parsed.port !== "54322") {
    throw new Error(
      "A fixture de diagnóstico só pode ser instalada no PostgreSQL local do Supabase (127.0.0.1:54322).",
    );
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
