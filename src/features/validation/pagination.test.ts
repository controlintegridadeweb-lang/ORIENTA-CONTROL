import { describe, expect, it } from "vitest";
import {
  clampValidationPage,
  parseValidationPage,
  parseValidationPageSize,
  parseValidationQueueKind,
  totalPagesFor,
} from "./pagination";

describe("validation queue pagination helpers", () => {
  it("interpreta tipo, página e tamanho com defaults seguros", () => {
    expect(parseValidationQueueKind("nao-se-aplica")).toBe("nao-se-aplica");
    expect(parseValidationQueueKind("outro")).toBe("evidencias");
    expect(parseValidationPage("3")).toBe(3);
    expect(parseValidationPage("0")).toBe(1);
    expect(parseValidationPageSize("20")).toBe(20);
    expect(parseValidationPageSize("15")).toBe(10);
  });

  it("calcula total de páginas e corrige página inválida", () => {
    expect(totalPagesFor(47, 10)).toBe(5);
    expect(clampValidationPage(9, 47, 10)).toBe(5);
    expect(clampValidationPage(0, 47, 10)).toBe(1);
    expect(clampValidationPage(2, 0, 10)).toBe(1);
  });
});
