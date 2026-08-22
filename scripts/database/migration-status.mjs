#!/usr/bin/env node
/**
 * Lista migrations locais vs aplicadas no remoto (supabase_migrations.schema_migrations).
 *
 * Uso: npm run db:status
 */
import pg from "pg";
import { readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, resolveDbUrl } from "../shared/load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(__dirname, "../../supabase/migrations");

loadEnv();

const dbUrl = resolveDbUrl();
if (!dbUrl) {
  console.error("Defina SUPABASE_DB_URL ou SUPABASE_DB_PASSWORD em .env.local.");
  process.exit(1);
}

const local = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const client = new pg.Client({ connectionString: dbUrl });

try {
  await client.connect();

  let remote = [];
  try {
    const { rows } = await client.query(
      `select version, name
       from supabase_migrations.schema_migrations
       order by version`,
    );
    remote = rows.map((r) => ({
      version: r.version,
      name: r.name ?? "",
    }));
  } catch (err) {
    if (err.code === "42P01") {
      console.log("Tabela supabase_migrations.schema_migrations ainda não existe (banco vazio ou sem push).\n");
    } else {
      throw err;
    }
  }

  const remoteVersions = new Set(remote.map((r) => r.version));

  console.log("Migration                          | Remoto");
  console.log("-----------------------------------|--------");
  for (const file of local) {
    const version = file.replace(/_.*$/, "");
    const applied = remoteVersions.has(version) ? "sim" : "pendente";
    console.log(`${file.padEnd(34)} | ${applied}`);
  }

  const pending = local.filter((f) => !remoteVersions.has(f.replace(/_.*$/, "")));
  console.log("");
  if (pending.length === 0) {
    console.log("Todas as migrations locais estão aplicadas no remoto.");
  } else {
    console.log(`Pendentes (${pending.length}): ${pending.join(", ")}`);
    console.log("Execute: npm run db:push");
  }
} finally {
  await client.end();
}
