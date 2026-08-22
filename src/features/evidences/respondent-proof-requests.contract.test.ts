import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/features/evidences/respondent-proof-requests.ts"),
  "utf8",
);

describe("respondent-proof-requests embeds", () => {
  it("desambigua form_versions→forms com a FK canônica", () => {
    expect(source).toContain("forms!form_versions_form_id_fkey!inner");
    expect(source).not.toMatch(/form_versions!inner\(\s*forms!inner/);
    expect(source).not.toMatch(/form_versions!inner\(forms!inner/);
  });
});
