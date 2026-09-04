#!/usr/bin/env node
/**
 * Guardrail estrutural de complexidade.
 *
 * Analisa código produtivo, scripts operacionais e E2E usando a AST do
 * TypeScript. O objetivo é bloquear concentração de responsabilidade em
 * arquivos, funções e componentes React antes que ela vire débito invisível.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const ROOTS = ["src", "scripts", "e2e"];
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const GENERATED = new Set([
  "src/infrastructure/supabase/database.types.ts",
  "src/features/reports/pdf/cover-asset-fallbacks.ts",
]);
const reportOnly = process.argv.includes("--report");

const LIMITS = {
  srcFileLines: 600,
  operationalFileLines: 600,
  functionLines: 375,
  e2eFunctionLines: 500,
  useStateCalls: 10,
  useEffectCalls: 6,
  immediateFilesPerDirectory: 35,
  routeDepth: 11,
};

function normalized(path) {
  return path.split("\\").join("/");
}

function walk(directory) {
  const result = [];
  for (const entry of readdirSync(directory)) {
    if (["node_modules", ".next", "coverage", "playwright-report", "test-results"].includes(entry)) continue;
    const path = join(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) result.push(...walk(path));
    else if (CODE_EXTENSIONS.has(extname(path))) result.push(normalized(path));
  }
  return result;
}

function sourceFile(path, text) {
  const kind = path.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : path.endsWith(".ts")
      ? ts.ScriptKind.TS
      : ts.ScriptKind.JS;
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
}

function functionName(node) {
  if (node.name && ts.isIdentifier(node.name)) return node.name.text;
  if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) return node.parent.name.text;
  if (ts.isPropertyAssignment(node.parent)) return node.parent.name.getText();
  return "função anônima";
}

function countHookCalls(file, hookName) {
  let total = 0;
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === hookName
    ) total += 1;
    ts.forEachChild(node, visit);
  }
  visit(file);
  return total;
}

const files = ROOTS.flatMap((root) => (existsSync(root) ? walk(root) : []));
const errors = [];
const notes = [];
const sized = [];
const functions = [];

for (const path of files) {
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n").length;
  sized.push({ path, lines });
  if (!GENERATED.has(path)) {
    const maxLines = path.startsWith("src/") ? LIMITS.srcFileLines : LIMITS.operationalFileLines;
    if (lines > maxLines) errors.push(`Arquivo grande demais (${lines} > ${maxLines}): ${path}`);
  }

  const file = sourceFile(path, text);
  if (file.parseDiagnostics.length > 0) {
    errors.push(`Arquivo com sintaxe inválida para análise: ${path}`);
    continue;
  }

  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) {
      const start = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
      const end = file.getLineAndCharacterOfPosition(node.end).line + 1;
      const lineCount = end - start + 1;
      const maxLines = path.startsWith("e2e/") ? LIMITS.e2eFunctionLines : LIMITS.functionLines;
      functions.push({ path, name: functionName(node), lines: lineCount });
      if (!GENERATED.has(path) && lineCount > maxLines) {
        errors.push(`Função grande demais (${lineCount} > ${maxLines}): ${path} :: ${functionName(node)}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);

  if (path.endsWith(".tsx") || path.endsWith(".ts")) {
    const useStateCalls = countHookCalls(file, "useState");
    const useEffectCalls = countHookCalls(file, "useEffect");
    if (useStateCalls > LIMITS.useStateCalls) {
      errors.push(`Estado local excessivo (${useStateCalls} useState > ${LIMITS.useStateCalls}): ${path}`);
    }
    if (useEffectCalls > LIMITS.useEffectCalls) {
      errors.push(`Efeitos excessivos (${useEffectCalls} useEffect > ${LIMITS.useEffectCalls}): ${path}`);
    }
  }
}

const directoryCounts = new Map();
for (const path of files) {
  const directory = path.slice(0, path.lastIndexOf("/"));
  directoryCounts.set(directory, (directoryCounts.get(directory) ?? 0) + 1);
}
for (const [directory, count] of directoryCounts) {
  if (count > LIMITS.immediateFilesPerDirectory) {
    notes.push(`Pasta com ${count} arquivos diretos: ${directory}`);
  }
}

for (const path of files.filter((item) => item.startsWith("src/app/"))) {
  const depth = path.split("/").length;
  if (depth > LIMITS.routeDepth) notes.push(`Rota com profundidade ${depth}: ${path}`);
}

sized.sort((a, b) => b.lines - a.lines);
functions.sort((a, b) => b.lines - a.lines);
const totalLines = sized.reduce((sum, item) => sum + item.lines, 0);

console.log("── Panorama de complexidade ───────────────────────────");
console.log(`Arquivos analisados : ${files.length} (src, scripts e e2e)`);
console.log(`Linhas totais       : ${totalLines}`);
console.log("5 maiores arquivos manuais:");
for (const item of sized.filter(({ path }) => !GENERATED.has(path)).slice(0, 5)) {
  console.log(`   ${String(item.lines).padStart(4)}  ${item.path}`);
}
console.log("5 maiores funções:");
for (const item of functions.slice(0, 5)) {
  console.log(`   ${String(item.lines).padStart(4)}  ${item.path} :: ${item.name}`);
}
console.log("───────────────────────────────────────────────────────");

if (notes.length > 0) {
  console.log(`\nInformações estruturais (${notes.length}):`);
  for (const note of notes) console.log(`   - ${note}`);
}

if (errors.length > 0) {
  console.log(`\n❌ Erros (${errors.length}):`);
  for (const error of errors) console.log(`   - ${error}`);
  if (!reportOnly) process.exit(1);
} else {
  console.log("\n✅ Arquivos, funções e hooks dentro dos limites definidos.");
}
