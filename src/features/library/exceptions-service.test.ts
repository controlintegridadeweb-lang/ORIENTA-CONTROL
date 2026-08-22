import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { ExceptionsService } from "./exceptions-service";
import { LibraryValidationError } from "./service";

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ORG_ID = "00000000-0000-4000-8000-000000000002";
const RECOMMENDATION_ID = "00000000-0000-4000-8000-000000000003";
const QUESTION_ID = "00000000-0000-4000-8000-000000000004";
const OTHER_QUESTION_ID = "00000000-0000-4000-8000-000000000005";
const USER_ID = "00000000-0000-4000-8000-000000000006";

type ExceptionTestRow = {
  id: string;
  organization_id: string;
  recommendation_id: string;
  question_id: string | null;
  motivo: string;
  prazo: string | null;
  status: "requested" | "approved" | "rejected" | "expired";
  requested_by: string | null;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

function exceptionRow(): ExceptionTestRow {
  return {
    id: "00000000-0000-4000-8000-000000000007",
    organization_id: ORG_ID,
    recommendation_id: RECOMMENDATION_ID,
    question_id: QUESTION_ID,
    motivo: "Justificativa institucional suficientemente detalhada.",
    prazo: null,
    status: "requested",
    requested_by: USER_ID,
    requested_at: "2026-07-13T12:00:00.000Z",
    decided_by: null,
    decided_at: null,
    created_at: "2026-07-13T12:00:00.000Z",
    updated_at: "2026-07-13T12:00:00.000Z",
  };
}

function fakeClient(scope: {
  organizationId: string;
  questionId: string;
  cycleState?: string;
} | null, activeActionIds: string[] = []) {
  const recommendationQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: scope
        ? {
            cycles: {
              organization_id: scope.organizationId,
              state: scope.cycleState ?? "validated",
            },
            question_versions: { question_id: scope.questionId },
          }
        : null,
      error: null,
    }),
  };
  recommendationQuery.select.mockReturnValue(recommendationQuery);
  recommendationQuery.eq.mockReturnValue(recommendationQuery);

  const exceptionQuery = {
    update: vi.fn(),
    insert: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    lt: vi.fn(),
    in: vi.fn(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    single: vi.fn().mockResolvedValue({ data: exceptionRow(), error: null }),
    then: vi.fn((resolve: (value: { data: null; error: null }) => void) =>
      resolve({ data: null, error: null }),
    ),
  };
  exceptionQuery.update.mockReturnValue(exceptionQuery);
  exceptionQuery.insert.mockReturnValue(exceptionQuery);
  exceptionQuery.select.mockReturnValue(exceptionQuery);
  exceptionQuery.eq.mockReturnValue(exceptionQuery);
  exceptionQuery.lt.mockReturnValue(exceptionQuery);
  exceptionQuery.in.mockReturnValue(exceptionQuery);

  const actionQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    limit: vi.fn().mockResolvedValue({
      data: activeActionIds.map((id) => ({ id })),
      error: null,
    }),
  };
  actionQuery.select.mockReturnValue(actionQuery);
  actionQuery.eq.mockReturnValue(actionQuery);
  actionQuery.neq.mockReturnValue(actionQuery);

  const from = vi.fn((table: string) =>
    table === "recommendations"
      ? recommendationQuery
      : table === "action_plans"
        ? actionQuery
        : exceptionQuery,
  );
  const rpc = vi.fn().mockResolvedValue({ data: Boolean(scope), error: null });

  return {
    client: { from, rpc } as unknown as SupabaseClient,
    from,
    rpc,
    exceptionQuery,
    actionQuery,
  };
}


function fakeDecisionClient(data: ExceptionTestRow | null) {
  const query = {
    update: vi.fn(),
    eq: vi.fn(),
    lt: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    then: vi.fn((resolve: (value: { data: null; error: null }) => void) =>
      resolve({ data: null, error: null }),
    ),
  };
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.lt.mockReturnValue(query);
  query.select.mockReturnValue(query);
  const from = vi.fn().mockReturnValue(query);
  return { client: { from } as unknown as SupabaseClient, query, from };
}


function payload(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: ORG_ID,
    recommendationId: RECOMMENDATION_ID,
    questionId: QUESTION_ID,
    motivo: "Justificativa institucional suficientemente detalhada.",
    ...overrides,
  };
}

describe("ExceptionsService.request", () => {
  it("cria a solicitação quando recomendação, organização e critério pertencem ao mesmo escopo", async () => {
    const { client, exceptionQuery } = fakeClient({
      organizationId: ORG_ID,
      questionId: QUESTION_ID,
    });

    const result = await new ExceptionsService(client).request(payload(), {
      userId: USER_ID,
    });

    expect(result.organizationId).toBe(ORG_ID);
    expect(exceptionQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: ORG_ID,
        recommendation_id: RECOMMENDATION_ID,
        question_id: QUESTION_ID,
      }),
    );
  });

  it("bloqueia a exceção quando ainda existe ação ativa", async () => {
    const { client, exceptionQuery } = fakeClient({
      organizationId: ORG_ID,
      questionId: QUESTION_ID,
    }, ["00000000-0000-4000-8000-000000000008"]);

    await expect(
      new ExceptionsService(client).request(payload(), { userId: USER_ID }),
    ).rejects.toMatchObject({ name: "LibraryConflictError" });
    expect(exceptionQuery.insert).not.toHaveBeenCalled();
  });

  it("bloqueia recomendação pertencente a outra organização antes da gravação", async () => {
    const { client, exceptionQuery } = fakeClient({
      organizationId: OTHER_ORG_ID,
      questionId: QUESTION_ID,
    });

    await expect(
      new ExceptionsService(client).request(payload(), { userId: USER_ID }),
    ).rejects.toBeInstanceOf(LibraryValidationError);
    expect(exceptionQuery.insert).not.toHaveBeenCalled();
  });

  it("bloqueia critério que não corresponde à recomendação", async () => {
    const { client, exceptionQuery } = fakeClient({
      organizationId: ORG_ID,
      questionId: OTHER_QUESTION_ID,
    });

    await expect(
      new ExceptionsService(client).request(payload(), { userId: USER_ID }),
    ).rejects.toBeInstanceOf(LibraryValidationError);
    expect(exceptionQuery.insert).not.toHaveBeenCalled();
  });

  it("bloqueia recomendação inexistente", async () => {
    const { client, exceptionQuery } = fakeClient(null);

    await expect(
      new ExceptionsService(client).request(payload(), { userId: USER_ID }),
    ).rejects.toBeInstanceOf(LibraryValidationError);
    expect(exceptionQuery.insert).not.toHaveBeenCalled();
  });
});

describe("ExceptionsService.decide", () => {
  it("decide somente exceções ainda pendentes", async () => {
    const row = { ...exceptionRow(), status: "approved" as const, decided_by: USER_ID, decided_at: "2026-07-13T13:00:00.000Z" };
    const { client, query } = fakeDecisionClient(row);

    const result = await new ExceptionsService(client).decide(
      row.id,
      { status: "approved" },
      { userId: USER_ID },
    );

    expect(result.status).toBe("approved");
    expect(query.eq).toHaveBeenCalledWith("id", row.id);
    expect(query.eq).toHaveBeenCalledWith("status", "requested");
  });

  it("bloqueia nova decisão quando a exceção já saiu do estado pendente", async () => {
    const { client } = fakeDecisionClient(null);

    await expect(
      new ExceptionsService(client).decide(
        "00000000-0000-4000-8000-000000000007",
        { status: "rejected" },
        { userId: USER_ID },
      ),
    ).rejects.toMatchObject({ name: "LibraryConflictError" });
  });

  it("rejeita campos de decisão que não são persistidos em vez de descartá-los silenciosamente", async () => {
    const from = vi.fn();
    const client = { from } as unknown as SupabaseClient;

    await expect(
      new ExceptionsService(client).decide(
        "00000000-0000-4000-8000-000000000007",
        {
          status: "approved",
          motivo: "Este campo não pertence ao contrato persistido da decisão.",
        },
        { userId: USER_ID },
      ),
    ).rejects.toBeInstanceOf(LibraryValidationError);

    expect(from).not.toHaveBeenCalled();
  });
});
