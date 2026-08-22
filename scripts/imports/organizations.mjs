#!/usr/bin/env node
/**
 * Sincroniza organizações a partir de CSV com nome e sigla.
 *
 * Uso:
 *   npm run import:organizations -- --file orgaos.csv
 *
 * Formato (cabeçalho opcional):
 *   nome,sigla
 *   "Secretaria de Estado da Administração",SEAD
 *
 * A sigla é obrigatória no schema e única sem diferenciar maiúsculas de
 * minúsculas. A importação faz upsert por nome, portanto a mesma fonte pode ser
 * reexecutada para manter a sigla atualizada.
 */

import { readFileSync, existsSync } from "node:fs";
import { createServiceRoleSupabaseClient } from "../shared/create-service-role-supabase-client.mjs";

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (quoted) {
      if (char === '"' && csv[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      if (value.length > 0) throw new Error("CSV inválido: aspas devem iniciar um campo.");
      quoted = true;
    } else if (char === ",") {
      row.push(value.trim());
      value = "";
    } else if (char === "\n") {
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  if (quoted) throw new Error("CSV inválido: campo com aspas não foi fechado.");
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function parseOrganizations(csv) {
  const rows = parseCsv(csv);
  const organizations = [];
  const names = new Set();
  const acronyms = new Set();

  for (const [index, row] of rows.entries()) {
    const [rawName = "", rawAcronym = "", ...extra] = row;
    const header = rawName.trim().toLowerCase();
    if (index === 0 && ["nome", "name", "organização", "organizacao"].includes(header)) {
      continue;
    }
    if (extra.some((field) => field.trim() !== "")) {
      throw new Error(`Linha ${index + 1}: esperado apenas nome e sigla.`);
    }

    const name = rawName.trim();
    const acronym = rawAcronym.trim().toUpperCase();
    if (!name || !acronym) {
      throw new Error(`Linha ${index + 1}: nome e sigla são obrigatórios.`);
    }

    const normalizedName = name.toLocaleLowerCase("pt-BR");
    const normalizedAcronym = acronym.toLocaleLowerCase("pt-BR");
    if (names.has(normalizedName)) {
      throw new Error(`Linha ${index + 1}: nome de organização duplicado no arquivo.`);
    }
    if (acronyms.has(normalizedAcronym)) {
      throw new Error(`Linha ${index + 1}: sigla duplicada no arquivo.`);
    }
    names.add(normalizedName);
    acronyms.add(normalizedAcronym);
    organizations.push({ name, acronym });
  }

  if (organizations.length === 0) {
    throw new Error("Nenhuma organização válida encontrada no CSV.");
  }
  return organizations;
}

const argv = process.argv.slice(2);
let file = null;
for (let index = 0; index < argv.length; index += 1) {
  if (argv[index] === "--file") file = argv[++index];
}
if (!file) fail("Uso: npm run import:organizations -- --file <arquivo.csv>");
if (!existsSync(file)) fail(`Arquivo não encontrado: ${file}`);

async function main() {
  const supabase = createServiceRoleSupabaseClient();
  const organizations = parseOrganizations(readFileSync(file, "utf8"));
  const { error } = await supabase
    .from("organizations")
    .upsert(organizations, { onConflict: "name" });
  if (error) throw error;

  console.log(`\n✓ Importação concluída. ${organizations.length} organização(ões) sincronizada(s).\n`);
}

main().catch((error) => fail(error?.message ?? String(error)));
