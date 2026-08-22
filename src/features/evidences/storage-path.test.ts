import { describe, expect, it } from "vitest";
import {
  buildEvidenceStoragePath,
  evidenceStoragePrefix,
  isEvidenceStoragePathForCycle,
} from "./storage-path";

const organizationId = "00000000-0000-4000-8000-000000000001";
const cycleId = "00000000-0000-4000-8000-000000000002";


describe("evidence storage path", () => {
  it("builds the canonical organization/cycle path", () => {
    expect(evidenceStoragePrefix(organizationId, cycleId)).toBe(
      `${organizationId}/${cycleId}/`,
    );
    expect(buildEvidenceStoragePath(organizationId, cycleId, "object", "arquivo.pdf")).toBe(
      `${organizationId}/${cycleId}/object-arquivo.pdf`,
    );
  });

  it("accepts only files stored below the exact cycle prefix", () => {
    const canonicalPath = `${organizationId}/${cycleId}/arquivo.pdf`;
    expect(
      isEvidenceStoragePathForCycle(canonicalPath, { organizationId, cycleId }),
    ).toBe(true);
    expect(
      isEvidenceStoragePathForCycle(`${organizationId}/outro-ciclo/arquivo.pdf`, {
        organizationId,
        cycleId,
      }),
    ).toBe(false);
  });
});
