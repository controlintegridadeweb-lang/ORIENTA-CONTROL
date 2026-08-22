#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { validateProductionEnv } from "./env-contract.mjs";

const issues = validateProductionEnv(process.env);
const report = {
  checkedAt: new Date().toISOString(),
  status: issues.length === 0 ? "pass" : "fail",
  issueCount: issues.length,
  issues,
};
const reportPath = resolve(process.env.PRODUCTION_GATE_REPORT ?? "var/release/environment-report.json");
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });

if (issues.length) {
  console.error("Configuração de produção inválida:");
  for (const issue of issues) console.error(`- ${issue.key}: ${issue.code}`);
  process.exit(1);
}
console.log(`Configuração de produção aprovada. Relatório: ${reportPath}`);
