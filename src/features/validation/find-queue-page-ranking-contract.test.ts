import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function compactSql(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function baselineSql(): string {
  const dir = join(process.cwd(), "supabase", "migrations");
  return readdirSync(dir)
    .filter((f) => /^\d{14}_.+\.sql$/.test(f))
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
}

/** Ranking canônico da fila de evidências (list + find devem coincidir). */
const EVIDENCE_STATUS_RANK = compactSql(`
  case
    when count(e.id) = 0 and r.admin_proof_status = 'validated_without_proof' then 3
    when count(e.id) = 0 and r.admin_proof_status = 'considered_insufficient' then 2
    when count(e.id) = 0 and r.admin_proof_status = 'proof_requested' then 1
    when count(e.id) = 0 then 0
    when bool_or(e.validation_status = 'adjustment_requested'::public.evidence_validation_status)
      then 1
    when bool_or(e.validation_status = 'pending'::public.evidence_validation_status)
      then 0
    when bool_or(e.validation_status = 'approved'::public.evidence_validation_status)
      then 3
    else 2
  end as status_rank
`);

const ORDER_BY = compactSql(`
  order by
    ranked.status_rank,
    ranked.axis_name,
    ranked.section_order,
    ranked.section_name,
    ranked.order_index,
    ranked.response_id
`);

describe("contrato de ranking da localização da fila", () => {
  it("list_* e find_* compartilham o ranking com admin_proof_status", () => {
    const sql = compactSql(baselineSql());

    expect(sql).toContain(EVIDENCE_STATUS_RANK);
    expect(sql).toContain("functionpublic.list_validation_queue_page");
    expect(sql).toContain("functionpublic.find_validation_queue_page_for_evidence");
    expect(sql).toContain("admin_proof_status='validated_without_proof'then3");
    expect(sql).toContain("admin_proof_status='considered_insufficient'then2");
    expect(sql).toContain("admin_proof_status='proof_requested'then1");
    expect(sql).toContain(ORDER_BY);
  });
});
