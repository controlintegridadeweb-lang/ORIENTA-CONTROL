#!/usr/bin/env node
/**
 * Sobe `next start` na porta 3003 com a build de homologação já gerada.
 * Não reutiliza um processo que já esteja escutando nessa porta.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadHomologacaoNextEnv, markerPath, portIsOpen } from "./homologacao-next.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const nextBin = resolve(root, "node_modules/next/dist/bin/next");

try {
  const loaded = loadHomologacaoNextEnv();
  if (!existsSync(nextBin)) {
    throw new Error("O executável do Next não foi encontrado. Execute npm ci.");
  }
  const marker = existsSync(markerPath(root)) ? readFileSync(markerPath(root), "utf8").trim() : "";
  if (marker !== loaded.summary.projectRef) {
    throw new Error(
      "A build de homologação não corresponde a este projeto. Execute npm run build:homologacao.",
    );
  }
  if (await portIsOpen(3003)) {
    throw new Error(
      "A porta 3003 já está em uso. O servidor de homologação não reutiliza um processo existente.",
    );
  }
  console.log(
    `Servidor de homologação na porta 3003. Projeto ${loaded.summary.projectRef}. Supabase ${loaded.summary.supabaseHost}.`,
  );
  const child = spawn(
    process.execPath,
    [nextBin, "start", "--hostname", "127.0.0.1", "--port", "3003"],
    { cwd: root, stdio: "inherit", env: loaded.env },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill(signal));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}
