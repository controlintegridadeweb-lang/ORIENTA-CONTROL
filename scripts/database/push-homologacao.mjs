#!/usr/bin/env node
/**
 * Aplica as migrações versionadas no projeto de homologação.
 * Exige a confirmação ORIENTA_HOMOLOGACAO_CONFIRM e não lê dados do projeto oficial.
 */
import { spawn } from "node:child_process";
import { prepareWritableEnvironment, publicTargetSummary } from "../shared/writable-target.mjs";

const root = process.cwd();

try {
  process.env.ORIENTA_TARGET = "homologacao";
  const identity = prepareWritableEnvironment({ destructive: true });
  const summary = publicTargetSummary(process.env);
  console.log(
    [
      `Projeto afetado: ${identity.projectRef}.`,
      `Supabase: ${summary.supabaseHost}.`,
      `Postgres: ${summary.databaseHost}.`,
      "Operação: supabase db push das migrações em supabase/migrations.",
      "Nenhum dado institucional do projeto oficial será lido ou copiado.",
    ].join("\n"),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

const databaseUrl = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim();
const child = spawn(
  "npx",
  ["supabase", "db", "push", "--db-url", databaseUrl, "--yes"],
  { cwd: root, stdio: "inherit", shell: true, env: process.env },
);
child.on("exit", (code) => process.exit(code ?? 1));
