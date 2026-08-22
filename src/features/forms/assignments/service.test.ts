import { beforeEach, describe, expect, it, vi } from "vitest";
import { FormAssignmentsService } from "./service";

const formVersionFixture = vi.hoisted(() => ({
  currentVersionId: null as string | null,
  state: "draft" as "draft" | "published" | "archived",
}));

function buildRepoStub() {
  return {
    listByFormId: vi.fn().mockResolvedValue([]),
    listOrganizationIdsByFormId: vi.fn().mockResolvedValue([]),
    listFormIdsByOrganizationId: vi.fn().mockResolvedValue([]),
    isAssigned: vi.fn().mockResolvedValue(false),
    listOrganizationIdsWithCycles: vi.fn().mockResolvedValue([]),
    syncAssignments: vi.fn().mockResolvedValue(undefined),
  };
}

vi.mock("@/infrastructure/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "forms") {
        const result = () => ({
          data: {
            id: "11111111-1111-4111-8111-000000000001",
            current_form_version_id: formVersionFixture.currentVersionId,
          },
          error: null,
        });
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn(async () => result()),
              single: vi.fn(async () => result()),
            }),
          }),
        };
      }
      if (table === "form_versions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn(async () => ({
                data: { state: formVersionFixture.state },
                error: null,
              })),
            }),
          }),
        };
      }
      if (table === "organizations") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "11111111-1111-4111-8111-111111111111" },
                { id: "22222222-2222-4222-8222-222222222222" },
              ],
              error: null,
            }),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      return {};
    }),
  })),
}));

describe("FormAssignmentsService.syncAssignments", () => {
  const orgA = "11111111-1111-4111-8111-111111111111";
  const orgB = "22222222-2222-4222-8222-222222222222";
  const orgC = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    formVersionFixture.currentVersionId = null;
    formVersionFixture.state = "draft";
  });

  it("adiciona e remove organizacoes conforme payload", async () => {
    const repo = buildRepoStub();
    repo.listOrganizationIdsByFormId
      .mockResolvedValueOnce([orgA, orgC])
      .mockResolvedValueOnce([orgA, orgB]);
    repo.listByFormId.mockResolvedValue([
      {
        id: "1",
        formId: "form-1",
        organizationId: orgA,
        organizationName: "A",
        assignedAt: "2026-01-01",
        assignedBy: null,
      },
      {
        id: "2",
        formId: "form-1",
        organizationId: orgB,
        organizationName: "B",
        assignedAt: "2026-01-02",
        assignedBy: null,
      },
    ]);

    const service = new FormAssignmentsService(repo as never);
    const summary = await service.syncAssignments(
      "11111111-1111-4111-8111-000000000001",
      { organizationIds: [orgA, orgB] },
      { userId: "admin-1" },
    );

    expect(repo.syncAssignments).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-000000000001",
      [orgA, orgB],
      "admin-1",
    );
    expect(summary.organizationIds).toEqual([orgA, orgB]);
  });

  it("impede remover organizacao que ja possui diagnostico", async () => {
    const repo = buildRepoStub();
    repo.listOrganizationIdsByFormId.mockResolvedValue([orgA]);
    repo.syncAssignments.mockRejectedValue(
      new Error("form_assignment_has_cycles"),
    );

    const service = new FormAssignmentsService(repo as never);

    await expect(
      service.syncAssignments(
        "11111111-1111-4111-8111-000000000001",
        { organizationIds: [] },
        { userId: "admin-1" },
      ),
    ).rejects.toMatchObject({
      issues: [
        expect.objectContaining({
          path: "organizationIds",
          message: expect.stringContaining("já possuem diagnóstico"),
        }),
      ],
    });
    expect(repo.syncAssignments).toHaveBeenCalledOnce();
  });

  it("impede remover a última atribuição de um formulário publicado", async () => {
    formVersionFixture.currentVersionId =
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    formVersionFixture.state = "published";
    const repo = buildRepoStub();
    repo.listOrganizationIdsByFormId.mockResolvedValue([orgA]);
    repo.syncAssignments.mockRejectedValue(
      new Error("form_published_requires_assignment"),
    );

    const service = new FormAssignmentsService(repo as never);

    await expect(
      service.syncAssignments(
        "11111111-1111-4111-8111-000000000001",
        { organizationIds: [] },
        { userId: "admin-1" },
      ),
    ).rejects.toMatchObject({
      issues: [
        expect.objectContaining({
          path: "organizationIds",
          message: expect.stringContaining("publicado"),
        }),
      ],
    });
    expect(repo.syncAssignments).toHaveBeenCalledOnce();
  });
});
