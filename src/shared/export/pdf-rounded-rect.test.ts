import { describe, expect, it } from "vitest";
import { PDFDocument, rgb } from "pdf-lib";
import { drawRoundedRect, roundedRectPath } from "./pdf-rounded-rect";

describe("roundedRectPath", () => {
  it("descreve o retângulo a partir da origem SVG (canto superior esquerdo)", () => {
    const path = roundedRectPath(100, 40, 6);
    expect(path.startsWith("M 6 0")).toBe(true);
    expect(path).toContain("Q 100 0 100 6");
    expect(path.endsWith("Z")).toBe(true);
  });
});

describe("drawRoundedRect", () => {
  it("emite preenchimento e contorno na página", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([200, 200]);
    drawRoundedRect(page, {
      x: 10,
      y: 20,
      width: 80,
      height: 40,
      radius: 6,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.7, 0.72, 0.75),
      borderWidth: 1,
    });
    const operators = page.node.Contents()?.toString() ?? "";
    expect(operators.length).toBeGreaterThan(0);
  });
});
