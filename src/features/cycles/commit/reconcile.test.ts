import { beforeEach, describe, expect, it, vi } from "vitest";

const { collectMock } = vi.hoisted(() => ({ collectMock: vi.fn() }));
vi.mock("./collect", () => ({ collectProcessingSnapshot: collectMock }));

import { famiPolicyFromProcessing, reconcileCycleFami } from "./reconcile";

const processing = {
  id: "proc-1",
  processing_version: 3,
  status: "completed" as const,
  fami_policy_version: "v4",
  fami_scoring_model: "evidence_weighted" as const,
  yes_without_evidence_weight: 1,
  yes_with_approved_evidence_weight: 1.5,
  thresholds: [
    { level: 1, maxPercentage: 20 },
    { level: 2, maxPercentage: 40 },
    { level: 3, maxPercentage: 60 },
    { level: 4, maxPercentage: 80 },
    { level: 5, maxPercentage: 100 },
  ],
};

type StoredRow = {
  scope_type: "section" | "axis" | "global";
  scope_id: string | null;
  points_obtained: number;
  points_possible: number;
  percentage: number;
  maturity_level: number | null;
};

function queryBuilder(result: { data: unknown; error: null }) {
  const builder: Record<string, unknown> & PromiseLike<unknown> = {
    then: (onfulfilled, onrejected) => Promise.resolve(result).then(onfulfilled, onrejected),
  };
  for (const method of ["select", "eq", "order", "limit", "in"]) {
    builder[method] = vi.fn(() => builder);
  }
  return builder;
}

function makeClient(storedRows: StoredRow[]) {
  const processingBuilder = queryBuilder({ data: processing, error: null }) as ReturnType<typeof queryBuilder> & {
    maybeSingle: ReturnType<typeof vi.fn>;
  };
  processingBuilder.maybeSingle = vi.fn().mockResolvedValue({ data: processing, error: null });
  const storedBuilder = queryBuilder({ data: storedRows, error: null });

  const from = vi.fn((table: string) => {
    if (table === "cycle_processings") return processingBuilder;
    return storedBuilder;
  });
  return { from } as never;
}

const matchingRows: StoredRow[] = [
  {
    scope_type: "section",
    scope_id: "section-1",
    points_obtained: 2.5,
    points_possible: 2.5,
    percentage: 100,
    maturity_level: 5,
  },
  {
    scope_type: "axis",
    scope_id: "axis-1",
    points_obtained: 2.5,
    points_possible: 2.5,
    percentage: 100,
    maturity_level: 5,
  },
  {
    scope_type: "global",
    scope_id: null,
    points_obtained: 2.5,
    points_possible: 2.5,
    percentage: 100,
    maturity_level: 5,
  },
];

describe("reconcileCycleFami", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    collectMock.mockResolvedValue({
      questions: [
        {
          id: "q-1",
          axisId: "axis-1",
          sectionId: "section-1",
          famiEnabled: true,
          requiresEvidence: false,
          answer: "yes",
          isNotApplicable: false,
          waived: false,
        },
        {
          id: "q-2",
          axisId: "axis-1",
          sectionId: "section-1",
          famiEnabled: true,
          requiresEvidence: true,
          answer: "yes",
          validationStatus: "approved",
          isNotApplicable: false,
          waived: false,
        },
      ],
    });
  });

  it("compara pontos, percentual e nível em todos os escopos congelados", async () => {
    const result = await reconcileCycleFami(makeClient(matchingRows), {
      cycleId: "cycle-1",
      cycleProcessingId: "proc-1",
    });

    expect(collectMock).toHaveBeenCalledWith(expect.anything(), {
      cycleId: "cycle-1",
      cycleProcessingId: "proc-1",
    });
    expect(result.policy.version).toBe("v4");
    expect(result.policy.yesWithApprovedEvidenceWeight).toBe(1.5);
    expect(result.recalculated.percentage).toBe(100);
    expect(result.scopes).toHaveLength(3);
    expect(result.matches).toBe(true);
  });

  it("detecta pontos divergentes mesmo quando percentual e nível são iguais", async () => {
    const oldBinaryRows = matchingRows.map((row) => ({
      ...row,
      points_obtained: 2,
      points_possible: 2,
    }));
    const result = await reconcileCycleFami(makeClient(oldBinaryRows), { cycleId: "cycle-1" });

    expect(result.recalculated.percentage).toBe(100);
    expect(result.stored?.percentage).toBe(100);
    expect(result.matches).toBe(false);
    expect(result.scopes.every((scope) => scope.matches)).toBe(false);
  });

  it("detecta escopo ausente ou excedente", async () => {
    const result = await reconcileCycleFami(makeClient(matchingRows.slice(1)), {
      cycleId: "cycle-1",
    });

    expect(result.matches).toBe(false);
    expect(result.scopes).toContainEqual(
      expect.objectContaining({ scopeType: "section", scopeId: "section-1", stored: null }),
    );
  });

  it("mantém N/A quando nenhum critério é aplicável", async () => {
    collectMock.mockResolvedValue({
      questions: [
        {
          id: "q-waived",
          axisId: "axis-1",
          sectionId: "section-1",
          famiEnabled: true,
          requiresEvidence: false,
          answer: "yes",
          isNotApplicable: false,
          waived: true,
        },
      ],
    });
    const nARows: StoredRow[] = ["section", "axis", "global"].map((scopeType) => ({
      scope_type: scopeType as StoredRow["scope_type"],
      scope_id: scopeType === "section" ? "section-1" : scopeType === "axis" ? "axis-1" : null,
      points_obtained: 0,
      points_possible: 0,
      percentage: 0,
      maturity_level: null,
    }));
    const result = await reconcileCycleFami(makeClient(nARows), { cycleId: "cycle-1" });

    expect(result.recalculated.maturityLevel).toBe("N/A");
    expect(result.matches).toBe(true);
  });
});

describe("famiPolicyFromProcessing", () => {
  it("recusa política congelada incompleta", () => {
    expect(() => famiPolicyFromProcessing({ ...processing, thresholds: [] })).toThrow(
      "fami_policy_invalid",
    );
  });

  it("recusa faixas duplicadas ou diferentes da política oficial", () => {
    expect(() => famiPolicyFromProcessing({
      ...processing,
      thresholds: [
        { level: 1, maxPercentage: 20 },
        { level: 1, maxPercentage: 40 },
        { level: 3, maxPercentage: 60 },
        { level: 4, maxPercentage: 80 },
        { level: 5, maxPercentage: 100 },
      ],
    })).toThrow("thresholds congelados divergem");

    expect(() => famiPolicyFromProcessing({
      ...processing,
      thresholds: processing.thresholds.map((threshold) =>
        threshold.level === 4 ? { ...threshold, maxPercentage: 85 } : threshold),
    })).toThrow("thresholds congelados divergem");
  });

  it("recusa versão de política diferente da versão oficial", () => {
    expect(() => famiPolicyFromProcessing({
      ...processing,
      fami_policy_version: "v2",
    })).toThrow("fami_policy_invalid");
  });
});
