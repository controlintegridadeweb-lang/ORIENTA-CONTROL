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

describe("contrato Storage–relatórios", () => {
  it("valida objeto, integridade e imutabilidade antes da finalização", () => {
    expect(migration).toContain("from storage.objects");
    expect(migration).toContain("so.bucket_id = 'relatorios'");
    expect(migration).toContain("report_storage_object_invalid");
    expect(migration).toContain("application/pdf");
    expect(migration).toContain("p_file_sha256");
    expect(migration).toContain("p_content_sha256");
    expect(migration).toContain("official_report_storage_object_immutable");
  });
});
