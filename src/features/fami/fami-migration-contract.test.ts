import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const schema = readFileSync(join(migrationsDir, "20260812000200_schema.sql"), "utf8");
const functions = readFileSync(join(migrationsDir, "20260812000500_functions.sql"), "utf8");
const compact = (value: string) => value.replace(/\s+/g, "").toLowerCase();

const officialThresholds = [
  { level: 1, maxPercentage: 20 },
  { level: 2, maxPercentage: 40 },
  { level: 3, maxPercentage: 60 },
  { level: 4, maxPercentage: 80 },
  { level: 5, maxPercentage: 100 },
];

describe("contrato canônico FAMI na baseline timestampada", () => {
  it("preserva políticas históricas e usa v7/2 pontos como padrão vigente", () => {
    const sql = compact(`${schema}\n${functions}`);
    expect(sql).toContain("fami_policy_versiontextnotnulldefault'v7'");
    expect(sql).toContain(
      "yes_with_approved_evidence_weightnumeric(6,3)notnulldefault2",
    );
    expect(sql).toContain("yes_with_approved_evidence_weightin(1.5,2)");
    expect(sql).toContain("fami_policy_versionin('v3','v4','v5','v6','v7')");
  });

  it("materializa a política v7 sem ponto provisório em critério com evidência", () => {
    const sql = compact(functions);
    expect(sql).toContain("functionpublic.calculate_live_fami_rows");
    expect(sql).toContain("functionpublic.finalize_validation_cycle");
    expect(sql).toContain("whenhas_approved_evidencethen2::numeric");
    expect(sql).toContain("else0::numeric");
    expect(sql).toContain("fami_policy_version='v7'");
  });

  it("mantém os cinco níveis oficiais de maturidade", () => {
    const sql = compact(functions);
    const thresholds = JSON.stringify(officialThresholds).toLowerCase();
    expect(sql).toContain(`thresholds='${thresholds}'::jsonb`);
  });
});
