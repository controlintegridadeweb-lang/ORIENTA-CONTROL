#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { prepareWritableEnvironment, publicTargetSummary } from "../shared/writable-target.mjs";

const root = process.cwd();
const playwrightCli = resolve(root, "node_modules/@playwright/test/cli.js");

try {
  process.env.ORIENTA_TARGET = "homologacao";
  prepareWritableEnvironment();
  const summary = publicTargetSummary(process.env);
  console.log(
    `Playwright usará o projeto ${summary.projectRef} em ${summary.supabaseHost}, pela porta 3003. O servidor da porta 3002 não será reutilizado.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

if (!existsSync(playwrightCli)) {
  console.error("O Playwright não está instalado. Execute npm ci.");
  process.exit(1);
}

try {
  await runNode("scripts/testing/confirm-homologacao-e2e-data.mjs");
  await runNode("scripts/testing/build-homologacao.mjs");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [playwrightCli, "test", "-c", "playwright.homologacao.config.ts"],
  { cwd: root, stdio: "inherit", env: { ...process.env, PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3003" } },
);
child.on("exit", (code) => process.exit(code ?? 1));

function runNode(script) {
  return new Promise((resolveRun, rejectRun) => {
    const childProcess = spawn(process.execPath, [script], {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    });
    childProcess.on("exit", (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${script} encerrou com código ${code ?? 1}.`));
    });
  });
}
