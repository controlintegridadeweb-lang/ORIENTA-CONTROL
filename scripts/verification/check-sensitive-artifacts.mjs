#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const ignoredDirectories = new Set(["node_modules", ".git", ".next", "coverage", "dist", "output"]);
const ignoredFiles = new Set(["package-lock.json"]);
const operationalRoots = ["src", "scripts", "e2e", ".github", "var"];
const findings = [];

const rules = [
  {
    name: "known_mfa_test_password",
    pattern: /Integridade123\.com/gi,
  },
  {
    name: "private_key_literal",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    name: "supabase_secret_key",
    pattern: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g,
  },
];

function walk(path) {
  for (const entry of readdirSync(path)) {
    if (ignoredDirectories.has(entry)) continue;
    const full = join(path, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (ignoredFiles.has(entry)) continue;
    if (!/\.(?:[cm]?[jt]sx?|ya?ml|json|env|txt)$/i.test(entry)) continue;

    const content = readFileSync(full, "utf8");
    for (const rule of rules) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(content)) {
        findings.push(`${relative(ROOT, full)}: ${rule.name}`);
      }
    }
  }
}

for (const segment of operationalRoots) {
  const path = join(ROOT, segment);
  try { walk(path); } catch {}
}

if (findings.length) {
  console.error("Artefatos sensíveis reprovados:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log("Artefatos sensíveis: nenhum segredo/credencial hardcoded detectado nos caminhos operacionais.");
