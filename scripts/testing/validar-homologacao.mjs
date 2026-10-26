#!/usr/bin/env node
/**
 * Validação integrada da homologação.
 * Não aplica migrações: essa operação é destrutiva em potencial e fica em db:push:homologacao.
 */
import { spawn } from "node:child_process";
import { prepareWritableEnvironment, publicTargetSummary } from "../shared/writable-target.mjs";

const steps = [
  "scripts/database/verify-homologacao.mjs",
  "scripts/database/verify-report-storage-homologacao.mjs",
  "scripts/testing/prepare-homologacao.mjs",
  "scripts/testing/e2e-homologacao.mjs",
];

try {
  process.env.ORIENTA_TARGET = "homologacao";
  prepareWritableEnvironment();
  const summary = publicTargetSummary(process.env);
  console.log(`Validação integrada autorizada para ${summary.projectRef} (${summary.supabaseHost}).`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

try {
  for (const script of steps) await runNode(script);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function runNode(script) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [script], {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${script} encerrou com código ${code ?? 1}.`));
    });
  });
}
