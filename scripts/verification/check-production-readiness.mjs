#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { validateGoLiveChecklistShape } from "../production/go-live-checklist-contract.mjs";

const failures = [];
const requiredFiles = [
  ".node-version",
  ".nvmrc",
  ".github/workflows/release-readiness.yml",
  ".github/dependabot.yml",
  "SECURITY.md",
  "src/app/api/health/live/route.ts",
  "src/app/api/health/ready/route.ts",
  "src/infrastructure/health/readiness-service.ts",
  "scripts/production/env-contract.mjs",
  "scripts/production/check-production-env.mjs",
  "scripts/production/prepare-vercel-env.mjs",
  "scripts/production/vercel-build.mjs",
  "scripts/production/smoke-test.mjs",
  "scripts/production/backup-database.mjs",
  "scripts/production/restore-drill.mjs",
  "scripts/production/check-go-live.mjs",
  "scripts/production/go-live-checklist-contract.mjs",
  "scripts/verification/check-sensitive-artifacts.mjs",
  "docs/current/PRODUCTION_READINESS.md",
  "docs/current/BACKUP_RESTORE.md",
  "docs/current/ROLLBACK.md",
  "docs/current/INCIDENT_RESPONSE.md",
  "var/greenfield/production-go-live-checklist.json",
];

function source(file) {
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}
function requireText(file, fragment, message) {
  if (!source(file).includes(fragment)) failures.push(message);
}
for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`Arquivo obrigatório ausente: ${file}`);
}
const pkg = JSON.parse(source("package.json") || "{}");
for (const script of [
  "check:production-env",
  "check:vercel-env",
  "sync:vercel-env",
  "check:production-readiness",
  "check:sensitive-artifacts",
  "check:go-live",
  "smoke:production",
  "backup:production",
  "restore:drill",
  "release:gate",
  "build:vercel",
]) {
  if (!pkg.scripts?.[script]) failures.push(`Script npm obrigatório ausente: ${script}`);
}
if (pkg.packageManager !== "npm@10.9.2") failures.push("packageManager deve permanecer fixado em npm@10.9.2");
if (!String(pkg.engines?.node ?? "").includes("<23")) failures.push("A versão principal do Node deve permanecer fixada em 22.x");

for (const key of [
  "HEALTHCHECK_SECRET",
  "SUPABASE_DB_URL",
  "BACKUP_AGE_RECIPIENT",
  "BACKUP_AGE_IDENTITY",
  "RESTORE_DRILL_TARGET_DB_URL",
  "RESTORE_DRILL_CONFIRM_TARGET",
  "PRODUCTION_BASE_URL",
  "EXPECTED_COMMIT",
]) {
  requireText(".env.example", key, `.env.example não documenta ${key}`);
}
requireText(".env.example", "NÃO cadastrar na Vercel", ".env.example deve separar variáveis locais das de runtime da Vercel");
requireText("scripts/production/check-production-env.mjs", "validateProductionEnv", "check-production-env deve reutilizar o contrato de env");
requireText("scripts/production/prepare-vercel-env.mjs", "buildVercelRuntimeEnv", "prepare-vercel-env deve montar o runtime a partir do .env.local");
requireText("src/app/api/health/ready/route.ts", "isReadinessRequestAuthorized", "Readiness deve permanecer protegida por segredo");
requireText("src/app/api/health/ready/route.ts", "503", "Readiness deve falhar com HTTP 503");
for (const contract of ["configuration", "database", "authentication", "storage", "upload_storage"]) {
  requireText("src/infrastructure/health/readiness-service.ts", `"${contract}"`, `Readiness não verifica ${contract}`);
}
for (const contract of ["npm run check:production-env", "npm audit", "npm run release:static", "npm run smoke:production"]) {
  requireText(".github/workflows/release-readiness.yml", contract, `Workflow de release sem: ${contract}`);
}
for (const path of ["var/release/*", "var/backups/*"]) {
  requireText(".gitignore", path, `.gitignore não protege ${path}`);
}

const checklistPath = "var/greenfield/production-go-live-checklist.json";
if (existsSync(checklistPath)) {
  try {
    const checklist = JSON.parse(source(checklistPath));
    for (const issue of validateGoLiveChecklistShape(checklist)) failures.push(`Checklist de go-live: ${issue}`);
  } catch {
    failures.push("Checklist de go-live não contém JSON válido");
  }
}

if (failures.length) {
  console.error("Prontidão para produção reprovada:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Prontidão para produção: contratos estruturais aprovados.");
