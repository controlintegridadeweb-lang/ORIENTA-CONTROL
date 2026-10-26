#!/usr/bin/env node
/**
 * Gera a build de produção do Next com as variáveis de homologação.
 * A compilação acontece aqui, antes do Playwright, para a jornada não
 * esperar a compilação sob demanda do `next dev`.
 */
import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  findRefInDirectory,
  loadHomologacaoNextEnv,
  markerPath,
} from "./homologacao-next.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const nextBin = resolve(root, "node_modules/next/dist/bin/next");

try {
  const loaded = loadHomologacaoNextEnv();
  if (!existsSync(nextBin)) {
    throw new Error("O executável do Next não foi encontrado. Execute npm ci.");
  }
  console.log(
    `Build de homologação. Projeto ${loaded.summary.projectRef}. Supabase ${loaded.summary.supabaseHost}.`,
  );
  const code = await spawnNext(nextBin, loaded.env);
  if (code !== 0) process.exit(code ?? 1);
  assertBundle(root, loaded.summary.projectRef, loaded.productionRef);
  writeFileSync(markerPath(root), `${loaded.summary.projectRef}\n`, "utf8");
  console.log(`Build conferida. Marcador do projeto ${loaded.summary.projectRef}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

function assertBundle(rootDir, homologacaoRef, productionRef) {
  const staticHits = findRefInDirectory(resolve(rootDir, ".next/static"), homologacaoRef);
  const serverHits = findRefInDirectory(resolve(rootDir, ".next/server"), homologacaoRef);
  if (staticHits.length === 0 && serverHits.length === 0) {
    throw new Error("A build não contém o projeto de homologação.");
  }
  const officialStatic = findRefInDirectory(resolve(rootDir, ".next/static"), productionRef);
  const officialServer = findRefInDirectory(resolve(rootDir, ".next/server"), productionRef);
  if (officialStatic.length > 0 || officialServer.length > 0) {
    throw new Error("A build contém o projeto oficial. A homologação foi interrompida.");
  }
}

function spawnNext(nextBin, env) {
  return new Promise((resolveExit) => {
    const child = spawn(process.execPath, [nextBin, "build", "--webpack"], {
      cwd: root,
      stdio: "inherit",
      env,
    });
    child.on("exit", (code) => resolveExit(code ?? 1));
  });
}
