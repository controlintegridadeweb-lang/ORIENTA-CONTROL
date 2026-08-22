import { describe, expect, it } from "vitest";
import { isInvalidUuidParam, parseUuidParam, uuidParamOrEmpty } from "./uuid";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("parâmetros UUID", () => {
  it("aceita e normaliza UUID válido", () => {
    expect(parseUuidParam(`  ${UUID}  `)).toBe(UUID);
    expect(uuidParamOrEmpty(UUID)).toBe(UUID);
    expect(isInvalidUuidParam(UUID)).toBe(false);
  });

  it("remove valores ausentes ou inválidos", () => {
    expect(parseUuidParam("cycle-1")).toBeUndefined();
    expect(uuidParamOrEmpty("cycle-1")).toBe("");
    expect(isInvalidUuidParam("cycle-1")).toBe(true);
    expect(isInvalidUuidParam(undefined)).toBe(false);
  });
});
