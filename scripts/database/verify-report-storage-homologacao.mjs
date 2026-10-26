#!/usr/bin/env node
import { spawn } from "node:child_process";

process.env.ORIENTA_TARGET = "homologacao";
const child = spawn(process.execPath, ["scripts/database/verify-report-storage.mjs"], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 1));
