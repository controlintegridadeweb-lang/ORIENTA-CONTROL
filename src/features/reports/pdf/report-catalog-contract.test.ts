import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs
  .readdirSync(path.join(process.cwd(), "supabase", "migrations"))
  .filter((name) => /^\d{14}_.+\.sql$/.test(name))
  .sort()
  .map((name) =>
    fs.readFileSync(path.join(process.cwd(), "supabase", "migrations", name), "utf8"),
  )
  .join("\n")
  .toLowerCase();

describe("catálogo de diagnósticos para relatório", () => {
  it("oferece busca, paginação e consulta exata por ciclo", () => {
    expect(migration).toContain("p_cycle_id uuid");
    expect(migration).toContain("p_search text");
    expect(migration).toContain("p_offset integer");
    expect(migration).toContain("count(*) over()");
    expect(migration).toContain("lower(c.period_label)");
    expect(migration).toContain("reference_start_year");
    expect(migration).toContain("reference_end_year");
    expect(migration).toContain("r.status in ('completed', 'legacy')");
  });
});
