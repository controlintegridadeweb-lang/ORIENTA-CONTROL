#!/usr/bin/env node
/**
 * Compara o contrato TypeScript consumido pela aplicação com o schema gerado
 * pelo Supabase CLI.
 *
 * Ignora metadata interna do gerador (PostgrestVersion, Relationships,
 * SetofOptions). Falha quando tabelas, colunas, Insert/Update, views, RPCs
 * ou enums realmente usados pela aplicação divergem.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const GENERATOR_METADATA_PROPERTIES = [
  "__InternalSupabase",
  "Relationships",
  "SetofOptions",
];

export function normalize(value) {
  return value.replace(/\r\n/g, "\n").trimEnd() + "\n";
}

export function canonicalizeTypeSource(source) {
  return normalize(source)
    .replace(/\{\s*\[key:\s*string\]:\s*Json\s*\|\s*undefined\s*\}/g, "{ [key: string]: Json }")
    .replace(/\bArgs:\s*never\b/g, "Args: Record<string, never>")
    .replace(/\bArgs:\s*Record<\s*PropertyKey\s*,\s*never\s*>/g, "Args: Record<string, never>")
    .replace(/\bReturns:\s*undefined\b/g, "Returns: null")
    .replace(
      /CompositeTypes:\s*\{\s*\[\s*_\s+in\s*never\s*\]:\s*never\s*\}/g,
      "CompositeTypes: Record<string, never>",
    );
}

export function stripGeneratorMetadata(source) {
  let result = canonicalizeTypeSource(source);
  for (const propertyName of GENERATOR_METADATA_PROPERTIES) {
    result = stripNamedProperty(result, propertyName);
  }
  return result;
}

export function extractPublicContract(source) {
  const stripped = stripGeneratorMetadata(source);
  const publicBlock = findIndentedPropertyBlock(stripped, "public", "  ");
  if (!publicBlock) {
    return { tables: {}, views: {}, functions: {}, enums: {} };
  }
  const wrapped = `\n${publicBlock}`;
  const tablesBlock = findIndentedPropertyBlock(wrapped, "Tables", "    ");
  const viewsBlock = findIndentedPropertyBlock(wrapped, "Views", "    ");
  const functionsBlock = findIndentedPropertyBlock(wrapped, "Functions", "    ");
  const enumsBlock = findIndentedPropertyBlock(wrapped, "Enums", "    ");
  const tables = tablesBlock ? extractTablesOrViews(tablesBlock) : {};
  const views = viewsBlock ? extractTablesOrViews(viewsBlock) : {};
  return {
    tables,
    views,
    functions: functionsBlock
      ? resolveFunctionReturnRelations(extractFunctions(functionsBlock), tables, views)
      : {},
    enums: enumsBlock ? extractEnums(enumsBlock) : {},
  };
}

export function diffPublicContracts(current, generated) {
  const lines = [];

  function reportNamed(label, left, right) {
    const diff = diffLists(left, right);
    if (diff.onlyLeft.length > 0) {
      lines.push(`${label} só no arquivo versionado: ${diff.onlyLeft.join(", ")}`);
    }
    if (diff.onlyRight.length > 0) {
      lines.push(`${label} só no schema gerado: ${diff.onlyRight.join(", ")}`);
    }
  }

  reportNamed("Tabelas", Object.keys(current.tables), Object.keys(generated.tables));
  reportNamed("Views", Object.keys(current.views), Object.keys(generated.views));
  reportNamed("Funções", Object.keys(current.functions), Object.keys(generated.functions));
  reportNamed("Enums", Object.keys(current.enums), Object.keys(generated.enums));

  for (const [label, currentMap, generatedMap, field] of [
    ["tabela", current.tables, generated.tables, "row"],
    ["insert da tabela", current.tables, generated.tables, "insert"],
    ["update da tabela", current.tables, generated.tables, "update"],
    ["view", current.views, generated.views, "row"],
    ["args da função", current.functions, generated.functions, "args"],
    ["retorno da função", current.functions, generated.functions, "returns"],
  ]) {
    for (const name of Object.keys(currentMap)) {
      if (!(name in generatedMap)) continue;
      const leftFields = currentMap[name][field] ?? [];
      const rightFields = generatedMap[name][field] ?? [];
      if (leftFields.length === 0 && rightFields.length === 0) continue;
      const diff = diffLists(leftFields, rightFields);
      if (diff.onlyLeft.length === 0 && diff.onlyRight.length === 0) continue;
      lines.push(
        `Campos da ${label} ${name}: versionado+=[${diff.onlyLeft.join(", ")}] gerado+=[${diff.onlyRight.join(", ")}]`,
      );
    }
  }

  for (const name of Object.keys(current.enums)) {
    if (!(name in generated.enums)) continue;
    const diff = diffLists(current.enums[name], generated.enums[name]);
    if (diff.onlyLeft.length === 0 && diff.onlyRight.length === 0) continue;
    lines.push(
      `Valores do enum ${name}: versionado+=[${diff.onlyLeft.join(", ")}] gerado+=[${diff.onlyRight.join(", ")}]`,
    );
  }

  return lines;
}

export function compareGeneratedTypeContracts(currentSource, generatedSource, options = {}) {
  const current = extractPublicContract(currentSource);
  const generated = extractPublicContract(generatedSource);
  const structuralDiffs = diffPublicContracts(current, generated);
  const typecheck = compileContractCompatibility(currentSource, generatedSource, options);
  return {
    current,
    generated,
    structuralDiffs,
    typecheck,
    ok: structuralDiffs.length === 0 && typecheck.status === 0,
  };
}

export function defaultTscPath(root) {
  return resolve(root, "node_modules", "typescript", "bin", "tsc");
}

function compileContractCompatibility(currentSource, generatedSource, options) {
  const root = options.root ?? resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const tsc = options.tscPath ?? defaultTscPath(root);
  const workdir = mkdtempSync(resolve(tmpdir(), "orienta-generated-types-"));
  try {
    writeFileSync(
      resolve(workdir, "database.current.ts"),
      stripGeneratorMetadata(currentSource),
      "utf8",
    );
    writeFileSync(
      resolve(workdir, "database.generated.ts"),
      stripGeneratorMetadata(generatedSource),
      "utf8",
    );
    writeFileSync(resolve(workdir, "compare.ts"), comparisonSource(), "utf8");
    const comparison = spawnSync(
      process.execPath,
      [
        tsc,
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--target",
        "ES2022",
        "--module",
        "ESNext",
        "--moduleResolution",
        "Bundler",
        resolve(workdir, "compare.ts"),
      ],
      {
        cwd: workdir,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    return {
      status: comparison.status ?? 1,
      output: [comparison.stdout, comparison.stderr].filter(Boolean).join("\n").trim(),
    };
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

function comparisonSource() {
  return [
    'import type { Database as CurrentDatabase, Json as CurrentJson } from "./database.current";',
    'import type { Database as GeneratedDatabase, Json as GeneratedJson } from "./database.generated";',
    "",
    "type Assert<T extends true> = T;",
    "type Extends<A, B> = [A] extends [B] ? true : false;",
    "type CanonicalTables<T> = T extends Record<PropertyKey, unknown> ? {",
    "  [K in keyof T]: T[K] extends { Row: infer Row; Insert: infer Insert; Update: infer Update }",
    "    ? { Row: Row; Insert: Insert; Update: Update }",
    "    : never;",
    "} : never;",
    "type CanonicalViews<T> = T extends Record<PropertyKey, unknown> ? {",
    "  [K in keyof T]: T[K] extends { Row: infer Row } ? { Row: Row } : never;",
    "} : never;",
    "type EmptyArgs = Record<string, never>;",
    "type CanonicalArgs<A> = [A] extends [never]",
    "  ? EmptyArgs",
    "  : { [K in keyof A]-?: A[K] | null };",
    "type CanonicalReturns<R> = R extends Array<infer Item>",
    "  ? Item extends Record<PropertyKey, unknown>",
    "    ? Array<{ [K in keyof Item]-?: Item[K] | null }>",
    "    : R",
    "  : R;",
    "type CanonicalFunctions<T> = T extends Record<PropertyKey, unknown> ? {",
    "  [K in keyof T]: T[K] extends { Args: infer Args; Returns: infer Returns }",
    "    ? { Args: CanonicalArgs<Args>; Returns: CanonicalReturns<Returns> }",
    "    : never;",
    "} : never;",
    "type CanonicalPublic<T> = {",
    "  Tables: CanonicalTables<T extends { Tables: infer Tables } ? Tables : Record<string, never>>;",
    "  Views: CanonicalViews<T extends { Views: infer Views } ? Views : Record<string, never>>;",
    "  Functions: CanonicalFunctions<T extends { Functions: infer Functions } ? Functions : Record<string, never>>;",
    "  Enums: T extends { Enums: infer Enums } ? Enums : Record<string, never>;",
    "  CompositeTypes: T extends { CompositeTypes: infer CompositeTypes } ? CompositeTypes : Record<string, never>;",
    "};",
    'type CurrentSchema = CanonicalPublic<CurrentDatabase["public"]>;',
    'type GeneratedSchema = CanonicalPublic<GeneratedDatabase["public"]>;',
    "type MismatchKeys<A, B> = {",
    "  [K in keyof A]: K extends keyof B",
    "    ? Extends<A[K], B[K]> extends true ? never : K",
    "    : K",
    "}[keyof A];",
    "type AssertNever<T extends never> = T;",
    "type CurrentCoversGenerated = AssertNever<MismatchKeys<CurrentSchema, GeneratedSchema>>;",
    "type GeneratedCoversCurrent = AssertNever<MismatchKeys<GeneratedSchema, CurrentSchema>>;",
    "type CurrentJsonCoversGenerated = Assert<Extends<CurrentJson, GeneratedJson>>;",
    "type GeneratedJsonCoversCurrent = Assert<Extends<GeneratedJson, CurrentJson>>;",
    "export type GeneratedTypesCompatibility =",
    "  | CurrentCoversGenerated",
    "  | GeneratedCoversCurrent",
    "  | CurrentJsonCoversGenerated",
    "  | GeneratedJsonCoversCurrent;",
    "",
  ].join("\n");
}

function stripNamedProperty(source, propertyName) {
  const needle = `${propertyName}:`;
  let result = source;
  let searchFrom = 0;
  while (searchFrom < result.length) {
    const found = result.indexOf(needle, searchFrom);
    if (found < 0) break;
    const before = found === 0 ? "\n" : result[found - 1];
    if (before !== "\n" && before !== " " && before !== "\t") {
      searchFrom = found + needle.length;
      continue;
    }
    let valueStart = found + needle.length;
    while (valueStart < result.length && /\s/.test(result[valueStart])) valueStart += 1;
    const opener = result[valueStart];
    let end;
    if (opener === "{" || opener === "[") {
      end = balancedEnd(result, valueStart) + 1;
    } else {
      end = result.indexOf("\n", valueStart);
      if (end < 0) end = result.length;
    }
    while (end < result.length && (result[end] === "," || result[end] === " ")) end += 1;
    const lineStart = result.lastIndexOf("\n", found - 1) + 1;
    result = `${result.slice(0, lineStart)}${result.slice(end)}`;
    searchFrom = lineStart;
  }
  return result;
}

function balancedEnd(source, startIndex) {
  const open = source[startIndex];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error(`Bloco TypeScript sem fechamento para '${open}'.`);
}

function sliceBalancedBlock(source, braceIndex) {
  if (source[braceIndex] !== "{") {
    throw new Error("Bloco TypeScript sem abertura '{'.");
  }
  return source.slice(braceIndex + 1, balancedEnd(source, braceIndex));
}

function findIndentedPropertyBlock(source, propertyName, indent) {
  const needle = `\n${indent}${propertyName}: {`;
  const found = source.indexOf(needle);
  if (found < 0) return null;
  return sliceBalancedBlock(source, found + needle.lastIndexOf("{"));
}

function extractKeysAtIndent(block, indent) {
  const keys = [];
  let depth = 0;
  for (const line of block.split("\n")) {
    if (depth === 0) {
      const match = line.match(new RegExp(`^${indent}([A-Za-z_][A-Za-z0-9_]*)\\??:`));
      if (match) keys.push(match[1]);
    }
    depth += (line.match(/\{/g) ?? []).length;
    depth -= (line.match(/\}/g) ?? []).length;
  }
  return keys;
}

function extractTablesOrViews(block) {
  const entities = {};
  for (const name of extractKeysAtIndent(block, "      ")) {
    const nested = findIndentedPropertyBlock(`\n${block}`, name, "      ");
    entities[name] = {
      row: nested ? extractKeysAtIndent(findBlock(nested, "Row") ?? "", "          ") : [],
      insert: nested ? extractKeysAtIndent(findBlock(nested, "Insert") ?? "", "          ") : [],
      update: nested ? extractKeysAtIndent(findBlock(nested, "Update") ?? "", "          ") : [],
    };
  }
  return entities;
}

function extractFunctions(block) {
  const entities = {};
  for (const name of extractKeysAtIndent(block, "      ")) {
    const nested = findIndentedPropertyBlock(`\n${block}`, name, "      ");
    const returns = nested ? extractFunctionReturns(nested) : { keys: [], relation: null };
    entities[name] = {
      args: nested ? extractKeysAtIndent(findBlock(nested, "Args") ?? "", "          ") : [],
      returns: returns.keys,
      relation: returns.relation,
    };
  }
  return entities;
}

const TABLE_ROW_RETURN =
  /\n        Returns:\s*Database\["public"\]\["(Tables|Views)"\]\["([^"]+)"\]\["Row"\](?:\s*\[\])?/;

function extractFunctionReturns(nested) {
  const block = findBlock(nested, "Returns");
  if (block) {
    return { keys: extractKeysAtIndent(block, "          "), relation: null };
  }
  const match = `\n${nested}`.match(TABLE_ROW_RETURN);
  return { keys: [], relation: match?.[2] ?? null };
}

function resolveFunctionReturnRelations(functions, tables, views) {
  for (const fn of Object.values(functions)) {
    const relation = fn.relation;
    delete fn.relation;
    if (fn.returns.length > 0 || !relation) continue;
    const entity = tables[relation] ?? views[relation];
    if (entity) fn.returns = entity.row;
  }
  return functions;
}

function extractEnums(block) {
  const enums = {};
  for (const name of extractKeysAtIndent(block, "      ")) {
    const lineMatch = block.match(
      new RegExp(`\\n      ${name}:\\s*\\|?\\s*([\\s\\S]*?)(?=\\n      [A-Za-z_]|$)`),
    );
    const body = lineMatch?.[1] ?? "";
    enums[name] = [...body.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  }
  return enums;
}

function findBlock(nested, propertyName) {
  return findIndentedPropertyBlock(`\n${nested}`, propertyName, "        ");
}

function diffLists(left, right) {
  const rightSet = new Set(right);
  const leftSet = new Set(left);
  return {
    onlyLeft: left.filter((item) => !rightSet.has(item)),
    onlyRight: right.filter((item) => !leftSet.has(item)),
  };
}
