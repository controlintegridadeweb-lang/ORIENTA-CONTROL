#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const errors = [];
const warnings = [];
const allowedSrcDirectories = new Set([
  "app",
  "application",
  "features",
  "infrastructure",
  "shared",
  "test",
]);
const allowedScriptDirectories = new Set([
  "bootstrap",
  "database",
  "imports",
  "maintenance",
  "production",
  "shared",
  "testing",
  "verification",
]);
const codeExtensions = new Set([".ts", ".tsx", ".js", ".mjs"]);

function slash(path) {
  return path.split("\\").join("/");
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  const output = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stats = statSync(path);
    if (stats.isDirectory()) output.push(...walk(path));
    else output.push(path);
  }
  return output;
}

function assertAllowedChildren(directory, allowed, label) {
  for (const name of readdirSync(directory)) {
    if (!statSync(join(directory, name)).isDirectory()) continue;
    if (!allowed.has(name)) errors.push(`${label} inesperado: ${join(directory, name)}`);
  }
}

function importSpecifiers(source) {
  const found = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source))) found.add(match[1]);
  }
  return [...found];
}

function resolveLocalImport(file, specifier) {
  let base;
  if (specifier.startsWith("@/")) {
    base = join(ROOT, "src", specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    base = resolve(dirname(join(ROOT, file)), specifier);
  } else {
    return null;
  }

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.mjs`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
    join(base, "index.js"),
    join(base, "index.mjs"),
  ];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? false;
}

function sourceLayer(file) {
  return slash(file).split("/")[1] ?? null;
}

function sourceFeature(file) {
  const parts = slash(file).split("/");
  return parts[1] === "features" ? parts[2] ?? null : null;
}

function gitTracked(path) {
  const result = spawnSync("git", ["ls-files", "--error-unmatch", "--", path], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0;
}

function importedFeature(specifier) {
  const match = specifier.match(/^@\/features\/([^/]+)(?:\/|$)/);
  return match?.[1] ?? null;
}

function assertLayerImport(file, specifier) {
  const layer = sourceLayer(file);
  const forbiddenByLayer = {
    shared: ["@/app/", "@/application/", "@/features/", "@/infrastructure/"],
    infrastructure: ["@/app/", "@/application/", "@/features/"],
    application: ["@/app/"],
    features: ["@/app/"],
  };
  const forbidden = forbiddenByLayer[layer] ?? [];
  if (forbidden.some((prefix) => specifier.startsWith(prefix))) {
    errors.push(`Dependência invertida em ${file}: ${specifier}`);
  }
}

function stronglyConnectedComponents(graph) {
  let index = 0;
  const stack = [];
  const onStack = new Set();
  const indexes = new Map();
  const lowLinks = new Map();
  const components = [];

  function visit(node) {
    indexes.set(node, index);
    lowLinks.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);

    for (const next of graph.get(node) ?? []) {
      if (!indexes.has(next)) {
        visit(next);
        lowLinks.set(node, Math.min(lowLinks.get(node), lowLinks.get(next)));
      } else if (onStack.has(next)) {
        lowLinks.set(node, Math.min(lowLinks.get(node), indexes.get(next)));
      }
    }

    if (lowLinks.get(node) !== indexes.get(node)) return;
    const component = [];
    let current;
    do {
      current = stack.pop();
      onStack.delete(current);
      component.push(current);
    } while (current !== node);
    components.push(component);
  }

  for (const node of graph.keys()) {
    if (!indexes.has(node)) visit(node);
  }
  return components;
}

assertAllowedChildren("src", allowedSrcDirectories, "Diretório de src");
assertAllowedChildren("scripts", allowedScriptDirectories, "Categoria de scripts");

for (const forbidden of ["src/lib", "src/components", "src/presentation", "private-import"]) {
  if (existsSync(forbidden)) errors.push(`Artefato ou camada obsoleta presente: ${forbidden}`);
}

// Cache incremental do `tsc`. O typecheck da CI cria o arquivo no workspace;
// o gate é não versioná-lo. `.gitignore` já cobre o artefato gerado.
if (gitTracked("tsconfig.tsbuildinfo")) {
  errors.push("Artefato ou camada obsoleta presente: tsconfig.tsbuildinfo");
}

for (const path of walk("src")) {
  if (slash(path).includes("/__tests__/")) {
    errors.push(`Testes devem ficar ao lado do domínio em pasta tests, não em __tests__: ${path}`);
  }
}

const runtimeImportDirectory = "var/imports";
if (existsSync(runtimeImportDirectory)) {
  for (const name of readdirSync(runtimeImportDirectory)) {
    if (name !== "README.md") {
      errors.push(`Dado operacional incluído no pacote da aplicação: ${join(runtimeImportDirectory, name)}`);
    }
  }
}

const sourceFiles = walk("src")
  .filter((path) => codeExtensions.has(extname(path)))
  .map(slash);
const featureGraph = new Map();
const moduleGraph = new Map(sourceFiles.map((file) => [file, new Set()]));
const deepFeatureImports = [];

for (const file of sourceFiles) {
  const source = readFileSync(file, "utf8");
  const fromFeature = sourceFeature(file);
  if (fromFeature && !featureGraph.has(fromFeature)) featureGraph.set(fromFeature, new Set());

  for (const specifier of importSpecifiers(source)) {
    assertLayerImport(file, specifier);

    const resolved = resolveLocalImport(file, specifier);
    if (resolved === false) {
      errors.push(`Import local sem destino: ${file} → ${specifier}`);
    } else if (typeof resolved === "string") {
      const target = slash(relative(ROOT, resolved));
      if (moduleGraph.has(target)) moduleGraph.get(file).add(target);
    }

    const toFeature = importedFeature(specifier);
    if (fromFeature && toFeature && fromFeature !== toFeature) {
      if (!featureGraph.has(toFeature)) featureGraph.set(toFeature, new Set());
      featureGraph.get(fromFeature).add(toFeature);
      // Entradas públicas além do index: ui.ts (client) e server.ts (server-only).
      // Misturar os dois no index.ts puxa server-only para o bundle do cliente.
      if (
        /^@\/features\/[^/]+\/.+/.test(specifier) &&
        !/^@\/features\/[^/]+\/(ui|server)$/.test(specifier)
      ) {
        deepFeatureImports.push(`${file} → ${specifier}`);
      }
    }
  }
}

for (const featureImport of deepFeatureImports) {
  errors.push(
    `Import interno de outro domínio; exponha pela API pública index.ts, ui.ts ou server.ts: ${featureImport}`,
  );
}

const cycles = stronglyConnectedComponents(featureGraph).filter((component) => component.length > 1);
for (const cycle of cycles) {
  errors.push(`Ciclo entre features: ${cycle.sort().join(" ↔ ")}`);
}

const moduleCycles = stronglyConnectedComponents(moduleGraph).filter(
  (component) => component.length > 1,
);
for (const cycle of moduleCycles) {
  errors.push(`Ciclo entre módulos TypeScript: ${cycle.sort().join(" ↔ ")}`);
}

for (const file of sourceFiles) {
  const source = readFileSync(file, "utf8");
  const isTestFile = /(?:\.test\.|\.spec\.|\/tests\/)/.test(file);
  if (file !== "src/infrastructure/api/fetch-client.ts" && /\bparseJson\s*</.test(source)) {
    errors.push(`Contrato HTTP confiado apenas por generic em ${file}; forneça um schema runtime.`);
  }
  if (/\bparseJson\s*\(\s*[^,()]+\s*\)/.test(source)) {
    errors.push(`parseJson sem schema runtime em ${file}.`);
  }
  if (!isTestFile && /\(\s*await\s+[\w.$]+\.json\([^)]*\)[\s\S]{0,80}\)\s+as\b/.test(source)) {
    errors.push(`Resposta HTTP convertida por casting em ${file}; valide o contrato em runtime.`);
  }
  if (!isTestFile && /\bas\s+unknown\s+as\b/.test(source)) {
    errors.push(`Coerção dupla oculta incompatibilidade de tipos em ${file}.`);
  }
}

const decisionsDirectory = "docs/current/decisions";
const decisionFiles = existsSync(decisionsDirectory)
  ? readdirSync(decisionsDirectory).filter((name) => /^ADR-\d{4}-.+\.md$/.test(name))
  : [];
if (decisionFiles.length < 8) {
  errors.push("Registro de decisões arquiteturais incompleto: são esperados ao menos 8 ADRs atuais");
}
for (const name of decisionFiles) {
  const source = readFileSync(join(decisionsDirectory, name), "utf8");
  for (const section of [
    "## Contexto",
    "## Decisão",
    "## Alternativas consideradas",
    "## Regra preservada",
    "## Consequências",
  ]) {
    if (!source.includes(section)) {
      errors.push(`ADR sem seção obrigatória ${section}: ${join(decisionsDirectory, name)}`);
    }
  }
}

if (warnings.length > 0) {
  console.warn("\nAvisos de arquitetura:\n");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length > 0) {
  console.error("\nFalha na arquitetura da árvore:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const edgeCount = [...featureGraph.values()].reduce((total, edges) => total + edges.size, 0);
console.log("✓ Camadas válidas: app, application, features, infrastructure e shared.");
console.log("✓ Imports locais resolvidos e sem dependências invertidas proibidas.");
console.log(`✓ Grafo de features acíclico (${featureGraph.size} domínios, ${edgeCount} dependências).`);
console.log("✓ Dependências entre domínios usam APIs públicas index.ts, ui.ts ou server.ts.");
console.log("✓ Grafo de módulos TypeScript acíclico, sem coerções duplas e com contratos HTTP validados em runtime.");
