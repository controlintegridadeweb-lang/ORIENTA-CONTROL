import { describe, expect, it } from "vitest";
import { evidenceFileUrl } from "./file-links";

describe("evidenceFileUrl", () => {
  it("gera endpoints autenticados para visualizar e baixar", () => {
    expect(evidenceFileUrl("evidence id")).toBe(
      "/api/evidences/evidence%20id/file",
    );
    expect(evidenceFileUrl("evidence id", { download: true })).toBe(
      "/api/evidences/evidence%20id/file?download=1",
    );
  });
});
