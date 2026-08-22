import { describe, expect, it } from "vitest";
import { hexToPdfRgb } from "./pdf-color";

describe("hexToPdfRgb", () => {
  it("converte os hex dos eixos para o espaço do pdf-lib", () => {
    const governance = hexToPdfRgb("#0097B2");
    expect(governance.red).toBeCloseTo(0, 5);
    expect(governance.green).toBeCloseTo(0x97 / 255, 5);
    expect(governance.blue).toBeCloseTo(0xb2 / 255, 5);

    const environmental = hexToPdfRgb("#16A34A");
    expect(environmental.green).toBeCloseTo(0xa3 / 255, 5);

    const social = hexToPdfRgb("#DB2777");
    expect(social.red).toBeCloseTo(0xdb / 255, 5);
  });

  it("rejeita hex inválido em vez de mascarar a cor", () => {
    expect(() => hexToPdfRgb("azul")).toThrow(/Hex inválido/);
  });
});
