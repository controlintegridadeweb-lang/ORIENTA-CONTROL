#!/usr/bin/env node
/**
 * Sobe o Supabase local a partir de um estado descartável.
 *
 * 1. encerra stack residual sem backup de volume;
 * 2. inicia de novo, com até 3 tentativas e diagnóstico na última falha.
 *
 * Não mascara erro de configuração: esgota as tentativas e encerra com o
 * status do CLI.
 */
import { runSupabase } from "../shared/supabase-cli-path.mjs";

const rootCwd = process.cwd();
const maxAttempts = 3;

function print(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

function isStackRunning() {
  const status = runSupabase(["status", "-o", "env"], {
    cwd: rootCwd,
    stdio: "pipe",
  });
  return status.status === 0 && /API_URL=/.test(status.stdout ?? "");
}

if (isStackRunning()) {
  console.log("Encerrando stack Supabase residual (sem backup de volume)...");
  const stop = runSupabase(["stop", "--no-backup"], {
    cwd: rootCwd,
    stdio: "pipe",
  });
  print(stop);
  if (stop.status !== 0) {
    console.error("Não foi possível encerrar a stack residual do Supabase local.");
    process.exit(stop.status ?? 1);
  }
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  console.log(`Iniciando Supabase local (tentativa ${attempt}/${maxAttempts})...`);
  const start = runSupabase(["start"], {
    cwd: rootCwd,
    stdio: "inherit",
  });
  if (start.status === 0) {
    process.exit(0);
  }

  console.error(`supabase start falhou na tentativa ${attempt}/${maxAttempts}.`);
  if (attempt === maxAttempts) {
    console.error("Diagnóstico da stack após esgotar as tentativas:");
    const status = runSupabase(["status"], { cwd: rootCwd, stdio: "inherit" });
    process.exit(start.status ?? status.status ?? 1);
  }

  const stop = runSupabase(["stop", "--no-backup"], {
    cwd: rootCwd,
    stdio: "pipe",
  });
  print(stop);
}

process.exit(1);
