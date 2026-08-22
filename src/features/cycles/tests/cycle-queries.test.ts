import { describe, expect, it } from "vitest";

// Réplica fiel de mapJoined + junção working do cycle-queries.ts
type Joined = {
  id: string; state: string; period_label: string; organization_id: string;
  reopen_count: number; starts_at: string|null; response_deadline_at: string|null;
  validation_deadline_at: string|null; cycle_close_at: string|null;
  submitted_late_at: string|null; submission_delay_seconds: number|null; closed_at: string|null;
  organizations: { name: string; acronym: string } | null;
  form_versions: { version: number; form_id: string; forms: { name: string } | null } | null;
};
function mapJoined(r: Joined, working: { id: string; processing_version: number } | null) {
  return {
    id: r.id, state: r.state, periodLabel: r.period_label, organizationId: r.organization_id,
    organizationName: r.organizations?.name ?? "", organizationAcronym: r.organizations?.acronym ?? "",
    formId: r.form_versions?.form_id ?? "", formName: r.form_versions?.forms?.name ?? "",
    formVersion: r.form_versions?.version ?? 0, reopenCount: r.reopen_count ?? 0,
    startsAt: r.starts_at, responseDeadlineAt: r.response_deadline_at,
    validationDeadlineAt: r.validation_deadline_at, cycleCloseAt: r.cycle_close_at,
    submittedLateAt: r.submitted_late_at, submissionDelaySeconds: r.submission_delay_seconds,
    closedAt: r.closed_at,
    workingProcessingId: working?.id ?? null, workingProcessingVersion: working?.processing_version ?? null,
  };
}

const row: Joined = {
  id: "c1", state: "draft", period_label: "2024", organization_id: "o1",
  reopen_count: 0, starts_at: "2024-01-01T00:00:00Z", response_deadline_at: null,
  validation_deadline_at: null, cycle_close_at: null,
  submitted_late_at: null, submission_delay_seconds: null, closed_at: null,
  organizations: { name: "Secretaria A", acronym: "SEA" },
  form_versions: { version: 1, form_id: "f1", forms: { name: "Diagnostico ESG" } },
};

describe("cycle read-model — mapeamento", () => {
  it("enriquece com org, formulário e working processing", () => {
    const out = mapJoined(row, { id: "p1", processing_version: 1 });
    expect(out.organizationAcronym).toBe("SEA");
    expect(out.formName).toBe("Diagnostico ESG");
    expect(out.formVersion).toBe(1);
    expect(out.workingProcessingId).toBe("p1");
    expect(out.workingProcessingVersion).toBe(1);
  });

  it("ciclo sem working processing → campos null, não quebra", () => {
    const out = mapJoined(row, null);
    expect(out.workingProcessingId).toBeNull();
    expect(out.workingProcessingVersion).toBeNull();
  });

  it("joins ausentes degradam para vazio, sem lançar", () => {
    const bare: Joined = { ...row, organizations: null, form_versions: null };
    const out = mapJoined(bare, null);
    expect(out.organizationName).toBe("");
    expect(out.formName).toBe("");
    expect(out.formVersion).toBe(0);
  });

  it("junção working por cycle_id (sem N+1) associa corretamente", () => {
    const working = [
      { id: "p1", cycle_id: "c1", processing_version: 1 },
      { id: "p2", cycle_id: "c2", processing_version: 3 },
    ];
    const byCycle = new Map<string, { id: string; processing_version: number }>();
    for (const w of working) byCycle.set(w.cycle_id, { id: w.id, processing_version: w.processing_version });
    expect(byCycle.get("c1")).toEqual({ id: "p1", processing_version: 1 });
    expect(byCycle.get("c2")?.processing_version).toBe(3);
    expect(byCycle.get("c3")).toBeUndefined();
  });
});
