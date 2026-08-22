import { describe, expect, it } from "vitest";
import { isFormFillRoute } from "./form-fill-route";

describe("isFormFillRoute", () => {
  it("reconhece a rota canônica de preenchimento por diagnóstico", () => {
    expect(isFormFillRoute("/respondente/ciclos/cycle-1")).toBe(true);
    expect(isFormFillRoute("/respondente/ciclos/cycle-1/enviado")).toBe(true);
    expect(isFormFillRoute("/respondente/formularios/form-1")).toBe(false);
    expect(isFormFillRoute("/respondente/ciclos/cycle-1/extra")).toBe(false);
  });
});
