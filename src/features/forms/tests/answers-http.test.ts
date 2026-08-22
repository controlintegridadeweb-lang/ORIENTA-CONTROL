import { describe, expect, it } from "vitest";
import { FormsValidationError } from "../admin-service";
import {
  parseAnswersListFilters,
  parseRespondentListCursor,
  parseRespondentListLimit,
} from "../answers-http";

const organizationId = "4f0f0fd5-9de1-425e-9bf3-c31bbc90b649";
const cycleId = "112f1309-4fa7-4e4e-96e5-eef30f5ce21f";

describe("answers-http", () => {
  it("converte filtros compartilhados de listagem e exportação", () => {
    const params = new URLSearchParams({
      organizationId,
      status: "submetida",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-12-31T23:59:59.999Z",
    });

    expect(parseAnswersListFilters(params)).toEqual({
      organizationId,
      status: "submetida",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-12-31T23:59:59.999Z",
    });
  });

  it("valida cursor e limite sem alterar o contrato HTTP", () => {
    const params = new URLSearchParams({
      cursorUpdatedAt: "2026-04-05T08:30:00.000Z",
      cursorCycleId: cycleId,
      limit: "25.9",
    });

    expect(parseRespondentListCursor(params)).toEqual({
      updatedAt: "2026-04-05T08:30:00.000Z",
      cycleId,
    });
    expect(parseRespondentListLimit(params)).toBe(25);
  });

  it("rejeita data ou limite inválidos", () => {
    expect(() => parseAnswersListFilters(new URLSearchParams({ from: "ontem" }))).toThrow(
      FormsValidationError,
    );
    expect(() => parseRespondentListLimit(new URLSearchParams({ limit: "0" }))).toThrow(
      FormsValidationError,
    );
  });
});
