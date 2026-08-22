#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  emailDeliveryWarning,
  parseRespondentSeed,
} from "./lib/respondent-seed.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const file = resolve(here, "../../supabase/seeds/respondent_accounts.csv");
const source = readFileSync(file, "utf8");
const rows = parseRespondentSeed(source);

if (rows.length !== 2) {
  throw new Error(`O seed mínimo deve conter 2 contas fictícias; encontradas ${rows.length}.`);
}
if (/temporary_password|password|senha/i.test(source.split("\n")[0])) {
  throw new Error("A fonte declarativa não pode conter coluna ou valor de senha.");
}

const warnings = rows.filter((row) => emailDeliveryWarning(row.email));
if (warnings.length > 0) {
  throw new Error(`O seed de desenvolvimento contém ${warnings.length} e-mail(s) estruturalmente inválido(s).`);
}
for (const row of rows) {
  if (!row.email.endsWith("@example.invalid")) {
    throw new Error(`O seed versionado deve usar somente e-mails fictícios @example.invalid: ${row.organizationAcronym}.`);
  }
  if (!/^Respondente de Desenvolvimento [A-B]$/.test(row.fullName)) {
    throw new Error(`O seed versionado não pode conter nome pessoal real: ${row.organizationAcronym}.`);
  }
}
console.log(`✓ Seed mínimo seguro: ${rows.length} contas fictícias, sem senhas nem dados pessoais.`);
