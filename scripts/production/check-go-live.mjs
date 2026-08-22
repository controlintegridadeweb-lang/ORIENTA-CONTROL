#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  REQUIRED_GO_LIVE_GATES,
  validateGoLiveApproval,
  validateGoLiveChecklistShape,
} from "./go-live-checklist-contract.mjs";

const args = new Set(process.argv.slice(2));
const schemaOnly = args.has("--schema-only");
const checklistPath = resolve(
  process.env.ORIENTA_GO_LIVE_CHECKLIST ?? "var/greenfield/production-go-live-checklist.json",
);

if (!existsSync(checklistPath)) {
  console.error(`Checklist ausente: ${checklistPath}`);
  process.exit(1);
}

let checklist;
try {
  checklist = JSON.parse(readFileSync(checklistPath, "utf8"));
} catch {
  console.error(`Checklist inválido: ${checklistPath}`);
  process.exit(1);
}

const issues = schemaOnly
  ? validateGoLiveChecklistShape(checklist)
  : validateGoLiveApproval(checklist);

if (issues.length) {
  console.error(schemaOnly ? "Checklist estrutural inválido:" : "Go-live não autorizado:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

if (schemaOnly) {
  console.log(`Checklist estruturalmente válido: ${checklistPath}`);
} else {
  console.log(`Go-live autorizado: ${checklistPath}`);
  console.log(`Gates aprovados: ${REQUIRED_GO_LIVE_GATES.length}`);
}
