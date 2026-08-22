import { describe, expect, it } from "vitest";
import {
  DomainAccessError,
  DomainConflictError,
  DomainNotFoundError,
  DomainUnavailableError,
  DomainValidationError,
  handleDomainError,
} from "./domain-errors";

describe("handleDomainError", () => {
  it("mapeia DomainValidationError -> 400 com issues", async () => {
    const res = handleDomainError(
      new DomainValidationError([{ path: "x", message: "ruim" }], "invalido"),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "invalido",
      issues: [{ path: "x", message: "ruim" }],
    });
  });

  it("mapeia DomainNotFoundError -> 404", async () => {
    const res = handleDomainError(new DomainNotFoundError("sumiu"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "sumiu" });
  });

  it("mapeia DomainConflictError -> 409", async () => {
    const res = handleDomainError(new DomainConflictError("conflito"));
    expect(res.status).toBe(409);
  });

  it("mapeia DomainAccessError -> 403", async () => {
    const res = handleDomainError(new DomainAccessError("sem acesso"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "sem acesso" });
  });

  it("DomainAccessError tem mensagem default", async () => {
    const res = handleDomainError(new DomainAccessError());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Acesso negado." });
  });

  it("mapeia DomainUnavailableError -> 501", async () => {
    const res = handleDomainError(
      new DomainUnavailableError("nao implementado"),
    );
    expect(res.status).toBe(501);
  });

  it("mapeia RPC ausente no schema cache -> 503 com mensagem acionável", async () => {
    const res = handleDomainError({
      code: "PGRST202",
      message:
        "Could not find the function public.commit_cycle_transition(...) in the schema cache",
      hint: "Perhaps you meant to call the function public.commit_fami_and_transition",
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error:
        "Este recurso está temporariamente indisponível. Tente novamente ou contate a equipe responsável.",
    });
  });

  it("subclasses ainda satisfazem instanceof da base (cobertura de Fragmento 1.b)", () => {
    class FooValidation extends DomainValidationError {}
    const e = new FooValidation([], "x");
    expect(e).toBeInstanceOf(DomainValidationError);
    expect(e).toBeInstanceOf(FooValidation);
  });

  describe("fallback 500", () => {
    it("não expõe error.message para Error comum", async () => {
      const res = handleDomainError(new Error("boom"));
      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({
        error: "Não foi possível concluir a operação. Tente novamente.",
        errorId: expect.any(String),
      });
    });

    it("aceita mensagem pública específica sem expor o erro interno", async () => {
      const res = handleDomainError(
        new Error("detalhe interno"),
        undefined,
        "Falha ao carregar os dados.",
      );
      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({
        error: "Falha ao carregar os dados.",
        errorId: expect.any(String),
      });
    });

    it("não expõe message/details/hint de erro cru do Supabase", async () => {
      const res = handleDomainError({
        message: "coluna inexistente",
        details: "linha 3",
        hint: "verifique a migration",
      });
      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({
        error: "Não foi possível concluir a operação. Tente novamente.",
        errorId: expect.any(String),
      });
    });

    it("usa mensagem pública estável quando não há mensagem", async () => {
      const res = handleDomainError(null);
      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({
        error: "Não foi possível concluir a operação. Tente novamente.",
        errorId: expect.any(String),
      });
    });

    it("extraHandlers tem prioridade sobre o mapeamento padrao", async () => {
      const { NextResponse } = await import("next/server");
      const res = handleDomainError(new DomainNotFoundError("x"), [
        (e) =>
          e instanceof DomainNotFoundError
            ? NextResponse.json({ error: "custom" }, { status: 410 })
            : null,
      ]);
      expect(res.status).toBe(410);
    });
  });
});
