#!/usr/bin/env node
/**
 * Monta o conjunto de variáveis que a Vercel pode receber a partir do .env.local.
 *
 * - NEXT_PUBLIC_APP_URL na Vercel NÃO pode ser localhost: usa PRODUCTION_BASE_URL.
 * - Tokens, URL de banco e chaves de backup ficam só no ambiente local/CI.
 * - --apply envia o conjunto validado via Vercel CLI (production + preview).
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnv } from "../shared/load-env.mjs";
import {
  VERCEL_FORBIDDEN_KEYS,
  VERCEL_OPTIONAL_KEYS,
  VERCEL_REQUIRED_KEYS,
  buildVercelRuntimeEnv,
  listPresentLocalOnlyKeys,
  validateProductionEnv,
} from "./env-contract.mjs";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const yes = args.has("--yes");
const appUrlFlag = process.argv.find((value) => value.startsWith("--app-url="))?.slice("--app-url=".length);

loadEnv();
const runtime = buildVercelRuntimeEnv(process.env, { appUrl: appUrlFlag });
const issues = validateProductionEnv(runtime);
const localOnly = listPresentLocalOnlyKeys(process.env);
const report = {
  checkedAt: new Date().toISOString(),
  status: issues.length === 0 ? "pass" : "fail",
  issueCount: issues.length,
  issues,
  runtimeKeys: Object.keys(runtime).filter((key) => runtime[key]),
  missingRuntimeKeys: VERCEL_REQUIRED_KEYS.filter((key) => !runtime[key]),
  unusedOptionalKeys: VERCEL_OPTIONAL_KEYS.filter((key) => !runtime[key]),
  localOnlyKeysPresent: localOnly,
  forbiddenIfCopied: VERCEL_FORBIDDEN_KEYS.filter((key) => localOnly.includes(key)),
};

const reportPath = resolve("var/release/vercel-env-plan.json");
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });

console.log("Plano de ambiente para a Vercel (valores omitidos):");
for (const key of [...VERCEL_REQUIRED_KEYS, ...VERCEL_OPTIONAL_KEYS]) {
  const state = runtime[key] ? "pronta" : key === "NEXT_PUBLIC_APP_URL" ? "ausente (defina PRODUCTION_BASE_URL)" : "ausente";
  console.log(`- ${key}: ${state}`);
}
if (localOnly.length) {
  console.log("Variáveis locais que NÃO vão para a Vercel:");
  for (const key of localOnly) console.log(`- ${key}`);
}
if (issues.length) {
  console.error("Conjunto de runtime inválido para a Vercel:");
  for (const issue of issues) console.error(`- ${issue.key}: ${issue.code}`);
}

console.log(`Relatório: ${reportPath}`);

if (!apply) {
  if (issues.length) process.exit(1);
  process.exit(0);
}

if (issues.length) {
  console.error("Não é possível enviar variáveis inválidas. Corrija o plano e rode de novo.");
  process.exit(1);
}
if (!yes) {
  console.error("Para enviar, use: npm run sync:vercel-env -- --yes");
  process.exit(1);
}

await syncToVercel(runtime);
console.log("Variáveis de runtime enviadas para production e preview.");

function run(command, commandArgs, { input } = {}) {
  return new Promise((ok, fail) => {
    const child = spawn(command, commandArgs, {
      stdio: input === undefined ? "inherit" : ["pipe", "inherit", "inherit"],
      env: process.env,
      shell: true,
    });
    if (input !== undefined) {
      child.stdin.write(input);
      child.stdin.end();
    }
    child.once("error", fail);
    child.once("exit", (code) =>
      code === 0 ? ok() : fail(new Error(`${command} ${commandArgs.join(" ")} encerrou com código ${code}.`)),
    );
  });
}

async function syncToVercel(env) {
  const keys = Object.keys(env).filter((key) => env[key]);
  for (const environment of ["production", "preview"]) {
    for (const key of keys) {
      try {
        await run("npx", ["vercel", "env", "rm", key, environment, "--yes"]);
      } catch {
        // A variável pode ainda não existir no ambiente remoto.
      }
      await run("npx", ["vercel", "env", "add", key, environment], { input: env[key] });
    }
  }
}
