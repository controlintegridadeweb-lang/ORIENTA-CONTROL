import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const AXIS_THEME = path.normalize("src/shared/theme/axis-theme.ts");
const AXIS_HEXES = ["#0097B2", "#16A34A", "#DB2777", "#E5F4F7", "#E8F6EE", "#FBE9F1"];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (/\.(ts|tsx|css)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const files = await walk(SRC);
const violations = [];

for (const file of files) {
  const relative = path.relative(ROOT, file);
  const source = await readFile(file, "utf8");
  const isTest = /\.(test|spec)\.[^.]+$/.test(relative);

  if (file.endsWith(".tsx") && /text-\[[0-9]+px\]/.test(source)) {
    violations.push(`${relative}: tamanho tipográfico arbitrário text-[Npx].`);
  }

  if (file.endsWith(".tsx")) {
    const designSystemImports = source.match(/@\/shared\/layout\/design-system/g)?.length ?? 0;
    if (designSystemImports > 1) {
      violations.push(`${relative}: imports duplicados do design system.`);
    }
  }

  if (
    file.endsWith(".tsx") &&
    relative.startsWith(path.normalize("src/features/improvement-management/")) &&
    /\bfont-bold\b/.test(source)
  ) {
    violations.push(`${relative}: use a hierarquia semântica compartilhada em vez de font-bold.`);
  }

  if (
    file.endsWith(".tsx") &&
    relative.startsWith(path.normalize("src/features/")) &&
    !relative.startsWith(path.normalize("src/features/auth/")) &&
    /<h[23][^>]*className="[^"]+"/.test(source)
  ) {
    violations.push(`${relative}: heading h2/h3 com classes locais; use typography/SectionHeader.`);
  }

  if (relative !== AXIS_THEME && !isTest) {
    for (const color of AXIS_HEXES) {
      if (source.toUpperCase().includes(color.toUpperCase())) {
        violations.push(`${relative}: cor estrutural ${color} fora da fonte única axis-theme.ts.`);
      }
    }
  }
}

if (violations.length) {
  console.error(`Consistência visual: ${violations.length} violação(ões).`);
  for (const violation of violations) console.error(` - ${violation}`);
  process.exit(1);
}

console.log(
  `Consistência visual aprovada: ${files.length} arquivos verificados; tipografia, headings, imports e paleta dos eixos seguem as fontes compartilhadas.`,
);
