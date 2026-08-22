import { describe, expect, it, vi } from "vitest";
import { LibraryService, LibraryValidationError } from "./service";
import type { LibraryAxis } from "./types";

type RepoStub = {
  findAxis: ReturnType<typeof vi.fn>;
  findSection: ReturnType<typeof vi.fn>;
  findRecommendation: ReturnType<typeof vi.fn>;
  findCatalogItem: ReturnType<typeof vi.fn>;
  updateItemStatus: ReturnType<typeof vi.fn>;
  findLatestVersion: ReturnType<typeof vi.fn>;
  closeVersion: ReturnType<typeof vi.fn>;
  insertItemVersion: ReturnType<typeof vi.fn>;
  listVersions: ReturnType<typeof vi.fn>;
};

function makeAxis(overrides: Partial<LibraryAxis> = {}): LibraryAxis {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    code: "GOV",
    name: "Governanca",
    description: null,
    ordem: 0,
    status: "draft",
    versionMajor: 0,
    versionMinor: 1,
    versionPatch: 0,
    version: "0.1.0",
    vigenteDe: null,
    vigenteAte: null,
    tags: [],
    createdBy: null,
    updatedBy: null,
    approvedBy: null,
    approvedAt: null,
    deprecatedBy: null,
    deprecatedAt: null,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function buildService(initial: LibraryAxis, laterState?: Partial<LibraryAxis>) {
  const final = { ...initial, ...(laterState ?? {}) };
  const findAxis = vi
    .fn()
    .mockResolvedValueOnce(initial)
    .mockResolvedValue(final);
  const findSection = vi.fn().mockResolvedValue(null);
  const findRecommendation = vi.fn().mockResolvedValue(null);
  const findCatalogItem = vi.fn(
    async (entity: "axes" | "sections" | "recommendations", id: string) => {
      if (entity === "axes") return findAxis(id);
      if (entity === "sections") return findSection(id);
      return findRecommendation(id);
    },
  );
  const repo: RepoStub = {
    findAxis,
    findSection,
    findRecommendation,
    findCatalogItem,
    updateItemStatus: vi.fn().mockResolvedValue(undefined),
    findLatestVersion: vi.fn().mockResolvedValue(null),
    closeVersion: vi.fn().mockResolvedValue(undefined),
    insertItemVersion: vi.fn().mockResolvedValue({
      id: "ver-1",
      itemType: "axis",
      itemId: initial.id,
      version: "0.1.0",
      versionMajor: 0,
      versionMinor: 1,
      versionPatch: 0,
      payload: {},
      hash: "hash",
      vigenteDe: "2025-01-02T00:00:00Z",
      vigenteAte: null,
      previousVersionId: null,
      publishedBy: null,
      publishedAt: "2025-01-02T00:00:00Z",
      deprecatedBy: null,
      deprecatedAt: null,
      createdAt: "2025-01-02T00:00:00Z",
    }),
    listVersions: vi.fn().mockResolvedValue([]),
  };
  const service = new LibraryService(repo as unknown as never);
  return { service, repo };
}

describe("LibraryService transitions", () => {
  it("rejects workflow transitions on fixed ESG axes", async () => {
    const axis = makeAxis({ status: "draft" });
    const { service, repo } = buildService(axis, { status: "in_review" });
    await expect(
      service.submitForReview("axes", axis.id, { userId: "user-1" }),
    ).rejects.toBeInstanceOf(LibraryValidationError);
    expect(repo.updateItemStatus).not.toHaveBeenCalled();
  });

  it("rejects publish on fixed ESG axes", async () => {
    const axis = makeAxis({ status: "draft" });
    const { service, repo } = buildService(axis, {
      status: "published",
      approvedBy: "user-1",
    });
    await expect(service.publish("axes", axis.id, { userId: "user-1" })).rejects.toBeInstanceOf(
      LibraryValidationError,
    );
    expect(repo.insertItemVersion).not.toHaveBeenCalled();
  });

  it("rejects publish from in_review on fixed ESG axes", async () => {
    const axis = makeAxis({ status: "in_review" });
    const { service, repo } = buildService(axis, {
      status: "published",
      approvedBy: "user-1",
    });
    await expect(service.publish("axes", axis.id, { userId: "user-1" })).rejects.toBeInstanceOf(
      LibraryValidationError,
    );
    expect(repo.insertItemVersion).not.toHaveBeenCalled();
  });

  it("rejects invalid transition (archived -> published)", async () => {
    const axis = makeAxis({ status: "archived" });
    const { service } = buildService(axis);
    await expect(
      service.publish("axes", axis.id, { userId: "user-1" }),
    ).rejects.toBeInstanceOf(LibraryValidationError);
  });

  it("requires justification to deprecate", async () => {
    const axis = makeAxis({ status: "published" });
    const { service } = buildService(axis);
    await expect(
      service.deprecate("axes", axis.id, { userId: "user-1" }),
    ).rejects.toBeInstanceOf(LibraryValidationError);
  });
});

describe("LibraryService auto defaults on create", () => {
  it("rejects create for fixed ESG axes", async () => {
    const service = new LibraryService({} as never);
    await expect(service.create("axes", { name: "Governança" })).rejects.toBeInstanceOf(
      LibraryValidationError,
    );
  });

  it("auto-generates code and ordem for section when missing", async () => {
    const axisId = "11111111-1111-4111-8111-111111111111";
    const createdSection = {
      id: "22222222-2222-4222-8222-222222222222",
      axisId,
      axisCode: "GOV",
      code: "GOV-001",
      name: "Transparência",
      description: null,
      ordem: 2,
      status: "draft" as const,
      versionMajor: 0,
      versionMinor: 1,
      versionPatch: 0,
      version: "0.1.0",
      vigenteDe: null,
      vigenteAte: null,
      tags: [],
      createdBy: null,
      updatedBy: null,
      approvedBy: null,
      approvedAt: null,
      deprecatedBy: null,
      deprecatedAt: null,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    const createSection = vi.fn().mockResolvedValue(createdSection);
    const findAxis = vi.fn().mockResolvedValue(makeAxis({ id: axisId, code: "GOV" }));
    const nextOrdemForSectionsByAxis = vi.fn().mockResolvedValue(2);
    const isCodeTaken = vi.fn().mockResolvedValue(false);

    const repo = {
      createSection,
      findAxis,
      nextOrdemForSectionsByAxis,
      isCodeTaken,
    };

    const service = new LibraryService(repo as unknown as never);
    const result = await service.create(
      "sections",
      { axisId, name: "Transparência" },
      { userId: "user-99" },
    );

    expect(nextOrdemForSectionsByAxis).toHaveBeenCalledWith(axisId);
    expect(isCodeTaken).toHaveBeenCalledWith("sections", "GOV-001");
    expect(createSection).toHaveBeenCalledTimes(1);
    const [inputArg] = createSection.mock.calls[0];
    expect(inputArg.ordem).toBe(2);
    expect(result.id).toBe(createdSection.id);
  });
});
