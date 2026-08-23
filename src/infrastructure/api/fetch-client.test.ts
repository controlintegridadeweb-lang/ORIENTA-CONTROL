import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseJson } from "./fetch-client";

const payloadSchema = z.object({ id: z.string().uuid(), name: z.string() });

function response(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("parseJson", () => {
  it("retorna somente payload compatível com o contrato", async () => {
    await expect(
      parseJson(
        response('{"id":"8fe14315-baa3-4321-a188-c58590d3da2f","name":"ORIENTA"}'),
        payloadSchema,
      ),
    ).resolves.toEqual({
      id: "8fe14315-baa3-4321-a188-c58590d3da2f",
      name: "ORIENTA",
    });
  });

  it("rejeita resposta vazia", async () => {
    await expect(parseJson(response("  "), payloadSchema)).rejects.toThrow(
      "O servidor retornou uma resposta vazia.",
    );
  });

  it("rejeita JSON malformado", async () => {
    await expect(parseJson(response("{"), payloadSchema)).rejects.toThrow(
      "Resposta inválida do servidor.",
    );
  });

  it("rejeita JSON que não satisfaz o contrato", async () => {
    await expect(
      parseJson(response('{"id":123,"name":null}'), payloadSchema),
    ).rejects.toThrow(
      "O servidor retornou dados incompatíveis com o contrato esperado.",
    );
  });

  it("repassa a mensagem de erro da API quando o contrato de sucesso não cabe", async () => {
    await expect(
      parseJson(
        new Response(
          '{"error":"Este parecer foi alterado por outro administrador."}',
          { status: 409, headers: { "Content-Type": "application/json" } },
        ),
        payloadSchema,
      ),
    ).rejects.toThrow("Este parecer foi alterado por outro administrador.");
  });
});
