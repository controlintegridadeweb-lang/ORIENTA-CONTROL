import { describe, expect, it } from "vitest";
import { objectContract, unknownRecordSchema } from "./contract-schema";

type ExampleContract = {
  id: string;
  total: number;
  active?: boolean;
  metadata: Record<string, unknown> | null;
};

const exampleSchema = objectContract<ExampleContract>("ExampleContract", {
  id: "string",
  total: "number",
  active: "optional-boolean",
  metadata: "nullable-object",
});

describe("objectContract", () => {
  it("aceita os campos declarados e mantém extensões aditivas", () => {
    expect(
      exampleSchema.parse({
        id: "registro-1",
        total: 3,
        metadata: { origem: "teste" },
        extra: "permitido",
      }),
    ).toEqual({
      id: "registro-1",
      total: 3,
      metadata: { origem: "teste" },
      extra: "permitido",
    });
  });

  it("rejeita campo obrigatório ausente", () => {
    expect(() => exampleSchema.parse({ total: 3, metadata: null })).toThrow();
  });

  it("rejeita número não finito e tipos incompatíveis", () => {
    expect(() =>
      exampleSchema.parse({ id: "registro-1", total: Number.NaN, metadata: null }),
    ).toThrow();
    expect(() =>
      exampleSchema.parse({ id: "registro-1", total: 3, active: "sim", metadata: null }),
    ).toThrow();
  });
});

describe("unknownRecordSchema", () => {
  it("aceita somente objetos JSON-like no nível raiz", () => {
    expect(unknownRecordSchema.parse({ chave: 1 })).toEqual({ chave: 1 });
    expect(() => unknownRecordSchema.parse([])).toThrow();
  });
});
