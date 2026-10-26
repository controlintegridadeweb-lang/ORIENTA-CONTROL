#!/usr/bin/env node
/**
 * Roda supabase/verify no Postgres real da homologação.
 * Não reaplica migrações nem o preâmbulo local de Auth/Storage.
 */
import { spawn } from "node:child_process";
import { prepareWritableEnvironment, publicTargetSummary } from "../shared/writable-target.mjs";
import { installDiagnosticTestFixture } from "../testing/diagnostic-test-fixture.mjs";

try {
  process.env.ORIENTA_TARGET = "homologacao";
  process.env.DB_VERIFY_ONLY = "1";
  prepareWritableEnvironment();
  const summary = publicTargetSummary(process.env);
  console.log(
    `Verificação SQL no projeto ${summary.projectRef} (${summary.databaseHost}). A fixture de diagnóstico será instalada antes dos 37 arquivos.`,
  );
  await installDiagnosticTestFixture();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

const child = spawn(process.execPath, ["scripts/database/verify.mjs"], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 1));
