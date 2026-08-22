import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function baselineSql(): string {
  const dir = path.join(process.cwd(), "supabase", "migrations");
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{14}_.+\.sql$/.test(f))
    .sort()
    .map((f) => fs.readFileSync(path.join(dir, f), "utf8"))
    .join("\n")
    .toLowerCase();
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8").toLowerCase();
}

const sql = baselineSql();
const dashboard = read("src/features/dashboard/queries.ts");
const bundle = read("src/application/automation/report-bundle-service.ts");
const closure = read("src/application/reporting/cycle-closure-service.ts");

describe("contrato de entrega do relatório oficial", () => {
  it("notifica somente após a transição preparing -> completed", () => {
    expect(sql).toContain("tg_op <> 'update'");
    expect(sql).toContain("old.status is distinct from 'preparing'");
    expect(sql).toContain("new.status is distinct from 'completed'");
    expect(sql).toContain("after update of status on public.reports");
    expect(sql).toContain("when (old.status = 'preparing' and new.status = 'completed')");
  });

  it("dashboard e bundle consomem o relatório documental concluído", () => {
    expect(dashboard).toContain('.in("status", ["completed", "legacy"])');
    expect(closure).toContain("persistofficialreport");
    expect(bundle).toContain("cycleclosureservice");
    expect(bundle).toContain("ensureclosedcyclereport");
  });
});