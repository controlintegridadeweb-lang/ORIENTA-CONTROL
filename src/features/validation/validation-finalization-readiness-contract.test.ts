import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = resolve(process.cwd(), "supabase/migrations");
const allMigrations = readdirSync(migrationsDir)
  .filter((name) => /^\d{14}_.+\.sql$/.test(name))
  .sort()
  .map((name) => readFileSync(resolve(migrationsDir, name), "utf8"))
  .join("\n");

describe("contrato de prontidão da finalização", () => {
  it("consulta a prontidão canônica no banco e não deriva a regra no TypeScript", () => {
    expect(allMigrations).toContain(
      "create or replace function public.get_validation_finalization_readiness(",
    );
    expect(allMigrations).toContain(
      "create or replace function public.list_validation_finalization_readiness(",
    );
    expect(allMigrations).toContain("'pendingEvidence'");
    expect(allMigrations).toContain("'pendingNotApplicable'");
    expect(allMigrations).toContain("'undecidedAbsentProof'");
    expect(allMigrations).toContain("'incompleteResponses'");
    expect(allMigrations).toContain("'missingRecommendations'");
    expect(allMigrations).toContain("'missingWorkingProcessing'");
  });

  it("bloqueia comprovação ausente sem decisão administrativa, inclusive proof_requested", () => {
    expect(allMigrations).toContain("v_undecided_absent_count");
    expect(allMigrations).toContain(
      "resp.admin_proof_status is distinct from 'validated_without_proof'",
    );
    expect(allMigrations).toContain(
      "resp.admin_proof_status is distinct from 'considered_insufficient'",
    );
    expect(allMigrations).toContain(
      "and not exists (\n      select 1\n      from public.evidences e\n      where e.response_id = resp.id\n        and e.deactivated_at is null\n    )",
    );
    expect(allMigrations).toContain(
      "and (\n      resp.admin_proof_status is null\n      or resp.admin_proof_status = 'proof_requested'\n    )",
    );
    expect(allMigrations).toContain("validation_unresolved_absent_proof");
  });

  it("o cliente só traduz o payload persistido", () => {
    const repository = readFileSync(
      resolve(
        process.cwd(),
        "src/features/validation/server/validation-finalization-readiness-repository.ts",
      ),
      "utf8",
    );
    expect(repository).toContain("list_validation_finalization_readiness");
    expect(repository).not.toContain('from("evidences")');
    expect(repository).toContain("pendingEvidence");
    expect(repository).toContain("undecidedAbsentProof");
  });
});
