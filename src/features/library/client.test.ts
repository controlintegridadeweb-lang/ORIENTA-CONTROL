import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchQuestionConfiguration } from "./client";

const formId = "123e4567-e89b-12d3-a456-426614174000";
const questionId = "123e4567-e89b-12d3-a456-426614174001";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchQuestionConfiguration", () => {
  it("aceita configuration null quando o rascunho ainda não tem binding", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ configuration: null }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchQuestionConfiguration(formId, questionId)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/admin/forms/${formId}/questions/${questionId}/binding`,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("aceita a configuração persistida quando o binding existe", async () => {
    const configuration = {
      questionId,
      sectionId: "123e4567-e89b-12d3-a456-426614174002",
      metric: {
        name: "Pergunta",
        description: null,
        answerType: "yes_no",
        interpretation: "qualitative",
      },
      bindings: {},
      responseMapping: {},
      coverageScore: 0,
      updatedBy: null,
      updatedAt: "2026-08-19T18:00:00.000Z",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ configuration })));

    await expect(fetchQuestionConfiguration(formId, questionId)).resolves.toEqual(configuration);
  });

  it("rejeita payload que não satisfaz o contrato da configuração", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ configuration: { questionId } })),
    );

    await expect(fetchQuestionConfiguration(formId, questionId)).rejects.toThrow(
      "O servidor retornou dados incompatíveis com o contrato esperado.",
    );
  });
});
