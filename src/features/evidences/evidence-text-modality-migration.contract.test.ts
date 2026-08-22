import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const read = (name: string) => readFileSync(join(migrationsDir, name), "utf8");
const compact = (sql: string) => sql.replace(/\s+/g, "").toLowerCase();

describe("contrato canônico da modalidade textual de evidência", () => {
  it("nasce no enum final da baseline", () => {
    const sql = read("20260812000100_extensions_types.sql");
    expect(sql).toMatch(/create\s+type\s+public\.evidence_kind\s+as\s+enum\s*\([\s\S]*?'text'/i);
  });

  it("modela title/text_body e XOR estrutural", () => {
    const sql = compact(read("20260812000200_schema.sql"));
    expect(sql).toContain("titletext");
    expect(sql).toContain("text_bodytext");
    expect(sql).toContain("kind='text'::public.evidence_kind");
    expect(sql).toContain("length(trim(text_body))>0");
    expect(sql).not.toContain("length(trim(text_body))>=20");
  });

  it("mantém as RPCs oficiais e supersede decisão sem comprovação", () => {
    const sql = compact(read("20260812000500_functions.sql"));
    expect(sql).toContain("functionpublic.apply_workbench_response");
    expect(sql).toContain("functionpublic.supersede_absent_proof_with_evidence");
    expect(sql).toContain("response.admin_proof_superseded_by_evidence");
    expect(sql).toContain("functionpublic.finalize_validation_cycle");
  });

  it("expõe title/text_body no read model operacional", () => {
    const view = compact(read("20260812000400_read_models.sql"));
    const functions = compact(read("20260812000500_functions.sql"));
    expect(view).toContain("createviewpublic.evidence_operational_view");
    expect(view).toContain("e.title");
    expect(view).toContain("e.text_body");
    expect(functions).toContain("functionpublic.list_evidences_page");
  });
});
