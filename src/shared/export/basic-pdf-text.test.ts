import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { wrapBasicPdfText } from "./basic-pdf-text";

describe("wrapBasicPdfText", () => {
  it("quebra palavras longas em vez de extrapolar a largura", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const lines = wrapBasicPdfText("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", font, 10, 80);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line, 10)).toBeLessThanOrEqual(80 + 0.01);
    }
  });

  it("preserva quebras de linha explícitas", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const lines = wrapBasicPdfText("primeira\nsegunda", font, 10, 400);
    expect(lines).toEqual(["primeira", "segunda"]);
  });
});
