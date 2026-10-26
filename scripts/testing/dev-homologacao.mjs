#!/usr/bin/env node
/**
 * Sobe o Next na porta 3003 com as variáveis de .env.homologacao.local.
 * O Next não carrega esse arquivo sozinho. Os valores são aplicados aqui
 * e prevalecem sobre o que já estiver no processo, inclusive o .env.local.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { prepareWritableEnvironment, publicTargetSummary } from "../shared/writable-target.mjs";

const root = process.cwd();
const nextBin = resolve(root, "node_modules/next/dist/bin/next");

try {
  process.env.ORIENTA_TARGET = "homologacao";
  prepareWritableEnvironment();
  assertAppPort();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

if (!existsSync(nextBin)) {
  console.error("O executável do Next não foi encontrado. Execute npm ci.");
  process.exit(1);
}

const summary = publicTargetSummary(process.env);
console.log(
  `Homologação pronta para iniciar. Projeto ${summary.projectRef}. Supabase ${summary.supabaseHost}. Postgres ${summary.databaseHost}. Porta 3003.`,
);

const child = spawn(process.execPath, [nextBin, "dev", "--webpack", "-p", "3003"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

function assertAppPort() {
  let parsed;
  try {
    parsed = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "");
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL de homologação é inválida.");
  }
  const localHost = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (!localHost || parsed.port !== "3003") {
    throw new Error(
      "A aplicação de homologação precisa usar http://127.0.0.1:3003 ou http://localhost:3003. A porta 3002 permanece com o servidor do .env.local.",
    );
  }
}
