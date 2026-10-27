#!/usr/bin/env node
import { spawn } from "node:child_process";
import { prepareWritableEnvironment } from "../shared/writable-target.mjs";

try {
  process.env.ORIENTA_TARGET = "homologacao";
  prepareWritableEnvironment();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

try {
  await runNode("scripts/testing/prepare-e2e.mjs");
  await runNode("scripts/testing/seed-homologacao.mjs");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function runNode(script) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [script], {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${script} encerrou com código ${code ?? 1}.`));
    });
  });
}
