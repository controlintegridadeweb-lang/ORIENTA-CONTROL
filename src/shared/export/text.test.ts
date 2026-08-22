import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { asciiSafe, latinPdfSafe } from "./text";

describe("latinPdfSafe", () => {
  it("preserva português e o travessão institucional", () => {
    expect(latinPdfSafe("Portfólio de recomendações — Órgão")).toBe(
      "Portfólio de recomendações — Órgão",
    );
    expect(latinPdfSafe("Seção 1 — Governança e Integridade")).toContain("Seção");
    expect(latinPdfSafe("Ação específica")).toBe("Ação específica");
  });

  it("substitui aspas curvas e reticências sem remover o restante do texto", () => {
    expect(latinPdfSafe("“texto”…")).toBe('"texto"...');
  });

  it("não usa a conversão ASCII que remove acentos", () => {
    expect(asciiSafe("Órgão")).toBe("Orgao");
    expect(latinPdfSafe("Órgão")).toBe("Órgão");
  });

  it("é aceito pelo Helvetica padrão do pdf-lib", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage();
    const text = latinPdfSafe("Portfólio — Seção 1 — Órgão");
    expect(() =>
      page.drawText(text, { font, size: 12, x: 50, y: 700 }),
    ).not.toThrow();
  });
});
