import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "../../supabase/migrations");

function latestFunctionBody(functionName) {
  const needle = `create or replace function public.${functionName}`;
  let body = "";
  for (const file of readdirSync(migrationsDir)
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .sort()) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const start = sql.toLowerCase().indexOf(needle.toLowerCase());
    if (start < 0) continue;
    body = sql.slice(start);
  }
  return body.replace(/\s+/g, " ");
}

describe("list_organization_respondents", () => {
  it("lista o perfil respondente mesmo sem linha visível em auth.users", () => {
    const body = latestFunctionBody("list_organization_respondents");
    expect(body.length).toBeGreaterThan(0);
    expect(body).toContain("from public.profiles p");
    expect(body).toContain("left join auth.users au on au.id = p.user_id");
    expect(body).toContain("au.email::text");
    expect(body).toContain("set_config('row_security', 'off', true)");
    expect(body).not.toMatch(/from public\.profiles p join auth\.users/);
    expect(body).toContain(
      "alter function public.list_organization_respondents(uuid) owner to",
    );
  });
});
