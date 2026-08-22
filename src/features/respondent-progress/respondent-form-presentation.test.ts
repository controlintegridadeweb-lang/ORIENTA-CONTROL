import { describe, expect, it } from "vitest";
import type { RespondentProgress } from "./contracts";
import { getRespondentFormPresentation } from "./respondent-form-presentation";

function progress(overrides: Partial<RespondentProgress> = {}): RespondentProgress {
  return {
    cycleId: "cycle-1",
    formId: "form-1",
    formName: "Diagnóstico de Integridade 2026",
    periodLabel: "2026.1",
    formVersion: 1,
    organizationName: "Corpo de Bombeiros Militar do Rio Grande do Norte",
    state: "in_response",
    totalQuestions: 96,
    answeredQuestions: 0,
    submissionReady: false,
    submissionBlockCount: 0,
    complementationRequests: 0,
    resolvedComplementationRequests: 0,
    ...overrides,
  };
}

describe("getRespondentFormPresentation", () => {
  it("não iniciado: orientação + iniciar, com progresso útil", () => {
    const view = getRespondentFormPresentation(progress());

    expect(view.statusLabel).toBe("Em preenchimento");
    expect(view.description).toBe("Este diagnóstico ainda não foi iniciado.");
    expect(view.primaryAction).toEqual({
      href: "/respondente/ciclos/cycle-1",
      label: "Iniciar diagnóstico",
    });
    expect(view.secondaryAction).toBeNull();
    expect(view.showProgress).toBe(true);
    expect(view.progress?.summary).toBe("0 de 96 perguntas respondidas");
    expect(view.progress?.percent).toBe(0);
  });

  it("em andamento: continuar + progresso sem redundância de prontidão", () => {
    const view = getRespondentFormPresentation(
      progress({
        answeredQuestions: 72,
        submissionBlockCount: 24,
      }),
    );

    expect(view.primaryAction?.label).toBe("Continuar diagnóstico");
    expect(view.description).toBe("24 itens pendentes antes do envio.");
    expect(view.showProgress).toBe(true);
    expect(view.progress).toMatchObject({
      completed: 72,
      total: 96,
      percent: 75,
      summary: "72 de 96 perguntas respondidas",
    });
  });

  it("pronto para envio: oculta barra e prioriza revisão", () => {
    const view = getRespondentFormPresentation(
      progress({
        answeredQuestions: 96,
        submissionReady: true,
        submissionBlockCount: 0,
      }),
    );

    expect(view.statusLabel).toBe("Pronto para envio");
    expect(view.statusTone).toBe("success");
    expect(view.primaryAction?.label).toBe("Revisar e enviar");
    expect(view.showProgress).toBe(false);
    expect(view.progress).toBeNull();
  });

  it("correções: progresso de complementação e CTA de ajuste", () => {
    const view = getRespondentFormPresentation(
      progress({
        state: "awaiting_adjustment",
        answeredQuestions: 96,
        complementationRequests: 2,
        resolvedComplementationRequests: 1,
        submissionBlockCount: 1,
      }),
    );

    expect(view.statusLabel).toBe("Correções solicitadas");
    expect(view.statusTone).toBe("warning");
    expect(view.description).toBe("1 correção pendente antes do reenvio.");
    expect(view.primaryAction?.label).toBe("Corrigir pendências");
    expect(view.showProgress).toBe(true);
    expect(view.progress).toMatchObject({
      kind: "corrections",
      completed: 1,
      total: 2,
      percent: 50,
      summary: "1 de 2 correções resolvidas",
    });
  });

  it("enviado e em validação: consulta como único próximo passo", () => {
    const submitted = getRespondentFormPresentation(progress({ state: "submitted" }));
    expect(submitted.statusLabel).toBe("Enviado");
    expect(submitted.primaryAction?.label).toBe("Ver respostas");
    expect(submitted.showProgress).toBe(false);

    const validating = getRespondentFormPresentation(progress({ state: "in_validation" }));
    expect(validating.statusLabel).toBe("Em validação");
    expect(validating.primaryAction?.label).toBe("Ver respostas");
    expect(validating.secondaryAction).toBeNull();
    expect(validating.showProgress).toBe(false);
  });

  it("validado: FAMI primário, respostas secundário, sem barra", () => {
    const view = getRespondentFormPresentation(
      progress({
        state: "validated",
        answeredQuestions: 96,
        submissionReady: true,
      }),
    );

    expect(view.statusLabel).toBe("Concluído");
    expect(view.statusTone).toBe("success");
    expect(view.description).toBe(
      "Seu diagnóstico foi concluído. O resultado FAMI está disponível.",
    );
    expect(view.primaryAction).toEqual({
      href: "/respondente/pontuacao-fami?cycleId=cycle-1",
      label: "Ver Resultado FAMI",
    });
    expect(view.secondaryAction).toEqual({
      href: "/respondente/ciclos/cycle-1",
      label: "Ver respostas",
    });
    expect(view.showProgress).toBe(false);
  });

  it("encerrado: FAMI permanece disponível e respostas são secundárias", () => {
    const view = getRespondentFormPresentation(
      progress({
        state: "completed",
        answeredQuestions: 8,
        totalQuestions: 8,
        submissionReady: true,
      }),
    );

    expect(view.statusLabel).toBe("Encerrado");
    expect(view.primaryAction?.label).toBe("Ver Resultado FAMI");
    expect(view.secondaryAction?.label).toBe("Ver respostas");
    expect(view.showProgress).toBe(false);
  });

  it("oculta Ver respostas quando não há respostas registradas", () => {
    const view = getRespondentFormPresentation(
      progress({
        state: "validated",
        answeredQuestions: 0,
        submissionReady: true,
      }),
    );

    expect(view.secondaryAction).toBeNull();
    expect(view.primaryAction?.label).toBe("Ver Resultado FAMI");
  });

  it("preserva returnTo no href de respostas quando há ano de contexto", () => {
    const view = getRespondentFormPresentation(
      progress({ state: "validated", answeredQuestions: 4 }),
      { contextYear: 2026 },
    );

    expect(view.secondaryAction?.href).toBe(
      `/respondente/ciclos/cycle-1?returnTo=${encodeURIComponent("/respondente/formularios?year=2026")}`,
    );
  });

  it("usa vocabulário oficial quando não há perguntas aplicáveis", () => {
    const view = getRespondentFormPresentation(
      progress({ totalQuestions: 0, answeredQuestions: 0 }),
    );

    expect(view.progress?.summary).toBe("Nenhuma pergunta aplicável");
    expect(view.description).toBe("Não há perguntas aplicáveis neste diagnóstico.");
  });
});
