// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RespondentProgress } from "@/features/respondent-progress";
import { RespondentFormProgressItem } from "./respondent-form-progress-item";

function progress(overrides: Partial<RespondentProgress> = {}): RespondentProgress {
  return {
    cycleId: "cycle-1",
    formId: "form-1",
    formName: "Diagnóstico 2026",
    periodLabel: "2026",
    formVersion: 2,
    organizationName: "Controladoria-Geral",
    state: "in_response",
    totalQuestions: 10,
    answeredQuestions: 10,
    submissionReady: false,
    submissionBlockCount: 1,
    complementationRequests: 0,
    resolvedComplementationRequests: 0,
    ...overrides,
  };
}

describe("RespondentFormProgressItem", () => {
  afterEach(() => cleanup());

  it("organiza hierarquia: título, organização, período e versão", () => {
    const { container } = render(<RespondentFormProgressItem form={progress()} variant="card" />);
    const text = container.textContent ?? "";

    expect(text.indexOf("Diagnóstico 2026")).toBeLessThan(text.indexOf("Controladoria-Geral"));
    expect(text.indexOf("Controladoria-Geral")).toBeLessThan(text.indexOf("Período:"));
    expect(text.indexOf("Período:")).toBeLessThan(text.indexOf("Versão:"));
    expect(text).not.toContain("Organização Controladoria-Geral");
  });

  it("não apresenta prontidão apenas porque todas as respostas foram preenchidas", () => {
    render(<RespondentFormProgressItem form={progress()} />);

    expect(screen.getByRole("link", { name: /continuar diagnóstico/i })).toBeTruthy();
    expect(screen.queryByText("Pronto para envio")).toBeNull();
    expect(screen.getByText("1 item pendente antes do envio.")).toBeTruthy();
  });

  it("pluraliza corretamente vários itens pendentes", () => {
    render(
      <RespondentFormProgressItem form={progress({ submissionBlockCount: 126 })} />,
    );

    expect(screen.getByText("126 itens pendentes antes do envio.")).toBeTruthy();
    expect(screen.queryByText(/items pendentes/i)).toBeNull();
  });

  it("mostra envio somente quando a prontidão de domínio está satisfeita", () => {
    render(
      <RespondentFormProgressItem
        form={progress({ submissionReady: true, submissionBlockCount: 0 })}
      />,
    );

    expect(screen.getByRole("status").textContent ?? "").toMatch(/revise e envie/i);
    expect(screen.getByRole("link", { name: /revisar e enviar/i })).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("oferece consulta única em enviado e em validação", () => {
    const { rerender } = render(
      <RespondentFormProgressItem form={progress({ state: "submitted" })} />,
    );

    expect(screen.getByRole("link", { name: /ver respostas/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /acompanhar envio/i })).toBeNull();

    rerender(<RespondentFormProgressItem form={progress({ state: "in_validation" })} />);
    expect(screen.getByRole("link", { name: /ver respostas/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /acompanhar validação/i })).toBeNull();
  });

  it("usa o vocabulário oficial quando não há perguntas aplicáveis", () => {
    render(
      <RespondentFormProgressItem
        form={progress({ totalQuestions: 0, answeredQuestions: 0, submissionBlockCount: 0 })}
      />,
    );

    expect(screen.getByText("Nenhuma pergunta aplicável")).toBeTruthy();
    expect(screen.queryByText("Nenhum critério aplicável")).toBeNull();
  });

  it("preserva o histórico concluído com FAMI primário e respostas secundárias", () => {
    render(
      <RespondentFormProgressItem
        form={progress({
          state: "completed",
          totalQuestions: 8,
          answeredQuestions: 8,
          submissionReady: true,
          submissionBlockCount: 0,
        })}
      />,
    );

    expect(screen.getByRole("listitem").getAttribute("aria-label")).toContain("Encerrado");
    expect(screen.queryByRole("progressbar")).toBeNull();
    const responsesLink = screen.getByRole("link", { name: /ver respostas/i });
    expect(responsesLink.getAttribute("href")).toBe("/respondente/ciclos/cycle-1");
    const famiLink = screen.getByRole("link", { name: /ver resultado fami/i });
    expect(famiLink.getAttribute("href")).toBe(
      "/respondente/pontuacao-fami?cycleId=cycle-1",
    );
  });

  it("oculta Ver respostas quando não há respostas registradas", () => {
    render(
      <RespondentFormProgressItem
        form={progress({
          state: "validated",
          totalQuestions: 8,
          answeredQuestions: 0,
          submissionReady: true,
          submissionBlockCount: 0,
        })}
      />,
    );

    expect(screen.queryByRole("link", { name: /ver respostas/i })).toBeNull();
    expect(screen.getByRole("link", { name: /ver resultado fami/i })).toBeTruthy();
  });

  it("mantém Ver respostas apontando ao ciclo específico com returnTo", () => {
    render(
      <RespondentFormProgressItem
        form={progress({
          state: "validated",
          answeredQuestions: 4,
        })}
        contextYear={2026}
        variant="card"
      />,
    );

    const responsesLink = screen.getByRole("link", { name: /ver respostas/i });
    expect(responsesLink.getAttribute("href")).toBe(
      `/respondente/ciclos/cycle-1?returnTo=${encodeURIComponent("/respondente/formularios?year=2026")}`,
    );
  });

  it("mostra progresso de correções sem repetir fração e percentual na mesma linha", () => {
    render(
      <RespondentFormProgressItem
        form={progress({
          state: "awaiting_adjustment",
          totalQuestions: 10,
          answeredQuestions: 10,
          complementationRequests: 2,
          resolvedComplementationRequests: 1,
          submissionBlockCount: 1,
        })}
      />,
    );

    expect(screen.getByText("1 de 2 correções resolvidas")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("1 correção pendente antes do reenvio.")).toBeTruthy();
    expect(screen.queryByText("1/2 · 50%")).toBeNull();
    expect(screen.queryByText("10/10 · 100%")).toBeNull();
  });

  it("pluraliza corretamente várias correções pendentes", () => {
    render(
      <RespondentFormProgressItem
        form={progress({
          state: "awaiting_adjustment",
          complementationRequests: 3,
          resolvedComplementationRequests: 1,
          submissionBlockCount: 1,
        })}
      />,
    );

    expect(
      screen.getByText("2 correções pendentes antes do reenvio."),
    ).toBeTruthy();
  });

  it("mantém um único botão primário quando FAMI e respostas estão disponíveis", () => {
    const { container } = render(
      <RespondentFormProgressItem
        form={progress({
          state: "validated",
          answeredQuestions: 8,
          submissionReady: true,
        })}
      />,
    );

    const primaryButtons = container.querySelectorAll("a.bg-brand");
    expect(primaryButtons).toHaveLength(1);
    expect(primaryButtons[0]?.textContent).toMatch(/ver resultado fami/i);
    expect(screen.getByRole("link", { name: /ver respostas/i })).toBeTruthy();
  });

  it("segue o fluxo do mockup: orientação em faixa e ações abaixo", () => {
    const { container } = render(
      <RespondentFormProgressItem
        form={progress({
          state: "validated",
          answeredQuestions: 8,
          submissionReady: true,
          submissionBlockCount: 0,
        })}
      />,
    );
    const text = container.textContent ?? "";
    const orientation =
      "Seu diagnóstico foi concluído. O resultado FAMI está disponível.";

    expect(screen.getByRole("status").textContent ?? "").toContain(orientation);
    expect(text.indexOf(orientation)).toBeGreaterThan(text.indexOf("Versão:"));
    expect(text.indexOf("Ver respostas")).toBeGreaterThan(text.indexOf(orientation));
    expect(text.indexOf("Ver Resultado FAMI")).toBeGreaterThan(text.indexOf("Ver respostas"));
  });
});
