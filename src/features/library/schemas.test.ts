import { describe, expect, it } from "vitest";
import { LIBRARY_CATALOG_ENTITIES } from "./types";
import {
  libraryAxisInputSchema,
  libraryCatalogEntitySchema,
  libraryCatalogInputSchemaByEntity,
  libraryRecommendationInputSchema,
  librarySectionInputSchema,
} from "./schemas";

describe("biblioteca schemas", () => {
  it("accepts a valid axis payload", () => {
    const result = libraryAxisInputSchema.safeParse({
      code: "GOV",
      name: "Governanca",
      description: "Eixo de governanca corporativa.",
      ordem: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects axis with short code", () => {
    const result = libraryAxisInputSchema.safeParse({
      code: "G",
      name: "Governanca",
      description: null,
      ordem: 0,
    });
    expect(result.success).toBe(false);
  });

  it("normalizes empty description to null", () => {
    const result = libraryAxisInputSchema.safeParse({
      code: "GOV",
      name: "Governanca",
      description: "   ",
      ordem: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeNull();
    }
  });

  it("accepts a valid section payload with axisId", () => {
    const result = librarySectionInputSchema.safeParse({
      axisId: "00000000-0000-4000-8000-000000000000",
      code: "GOV-1",
      name: "Politicas",
      description: null,
      ordem: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects section with invalid axisId", () => {
    const result = librarySectionInputSchema.safeParse({
      axisId: "not-a-uuid",
      code: "GOV-1",
      name: "Politicas",
      ordem: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid recommendation", () => {
    const result = libraryRecommendationInputSchema.safeParse({
      code: "R1",
      title: "Implementar politica",
      description: null,
    });
    expect(result.success).toBe(true);
  });

  it("exposes a catalog schema that matches the supported entities", () => {
    for (const entity of LIBRARY_CATALOG_ENTITIES) {
      const entityParsed = libraryCatalogEntitySchema.safeParse(entity);
      expect(entityParsed.success).toBe(true);
      expect(libraryCatalogInputSchemaByEntity[entity]).toBeDefined();
    }
    expect(libraryCatalogEntitySchema.safeParse("actions").success).toBe(false);
    expect(libraryCatalogEntitySchema.safeParse("metrics").success).toBe(false);
    expect(libraryCatalogEntitySchema.safeParse("invalid").success).toBe(false);
  });
});
