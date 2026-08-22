import { describe, expect, it } from "vitest";
import { safePostLoginRedirect } from "./safe-redirect";

describe("safePostLoginRedirect", () => {
  it("preserva caminho e query string dentro da área do usuário", () => {
    expect(
      safePostLoginRedirect(
        "/respondente/ciclos/abc?questionId=xyz&returnTo=evidencias",
        "respondent",
      ),
    ).toBe("/respondente/ciclos/abc?questionId=xyz&returnTo=evidencias");
  });

  it("impede redirecionamentos externos e caminhos de outro papel", () => {
    expect(safePostLoginRedirect("//example.com", "admin")).toBe("/admin");
    expect(safePostLoginRedirect("/respondente", "admin")).toBe("/admin");
    expect(safePostLoginRedirect("https://example.com", "respondent")).toBe("/respondente");
  });
});
