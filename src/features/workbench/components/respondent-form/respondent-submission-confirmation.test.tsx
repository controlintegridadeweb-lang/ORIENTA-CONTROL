// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  formatSubmissionDateTime,
  formatSubmissionDelay,
  RespondentSubmissionConfirmation,
} from "./respondent-submission-confirmation";

describe("RespondentSubmissionConfirmation", () => {
  it("exibe a confirmação, o instante institucional e as próximas ações", () => {
    render(
      <RespondentSubmissionConfirmation
        cycleId="cycle-1"
        formName="Diagnóstico de Integridade"
        periodLabel="2026"
        submittedAt="2026-07-21T23:15:00.000Z"
        state="submitted"
        diagnosesHref="/respondente/formularios?year=2026"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Diagnóstico enviado para validação" }),
    ).toBeTruthy();
    expect(screen.getByText("21/07/2026 às 20:15")).toBeTruthy();
    expect(screen.getByText("Aguardando validação")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Voltar aos meus diagnósticos" }).getAttribute("href"),
    ).toBe("/respondente/formularios?year=2026");
    expect(
      screen.getByRole("link", { name: "Ver respostas enviadas" }).getAttribute("href"),
    ).toBe(
      "/respondente/ciclos/cycle-1?returnTo=%2Frespondente%2Fformularios%3Fyear%3D2026",
    );
  });

  it.each([
    ["in_validation", "Diagnóstico em validação", "Acompanhar validação"],
    ["awaiting_adjustment", "Correções solicitadas", "Corrigir pendências"],
    ["validated", "Diagnóstico validado", "Ver Resultado FAMI"],
    ["completed", "Avaliação encerrada", "Ver relatórios"],
  ] as const)("apresenta a devolutiva correspondente ao estado %s", (state, title, action) => {
    render(
      <RespondentSubmissionConfirmation
        cycleId="cycle-1"
        formName="Diagnóstico de Integridade"
        periodLabel="2026"
        submittedAt="2026-07-21T23:15:00.000Z"
        state={state}
        diagnosesHref="/respondente/formularios"
      />,
    );

    expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    expect(screen.getByRole("link", { name: action })).toBeTruthy();
  });

  it("diferencia o reenvio de correções do primeiro envio", () => {
    render(
      <RespondentSubmissionConfirmation
        cycleId="cycle-1"
        formName="Diagnóstico de Integridade"
        periodLabel="2026"
        submittedAt="2026-07-21T23:15:00.000Z"
        state="in_validation"
        diagnosesHref="/respondente/formularios"
        submissionKind="corrections"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Correções reenviadas para validação" }),
    ).toBeTruthy();
    expect(screen.getByText("Correções em validação")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Acompanhar correções" })).toBeTruthy();
  });

  it("informa atraso sem bloquear a confirmação", () => {
    render(
      <RespondentSubmissionConfirmation
        cycleId="cycle-1"
        formName="Diagnóstico de Integridade"
        periodLabel="2026"
        submittedAt="2026-07-21T23:15:00.000Z"
        submittedLateAt="2026-07-21T23:15:00.000Z"
        submissionDelaySeconds={93_900}
        state="submitted"
        diagnosesHref="/respondente/formularios"
      />,
    );

    expect(screen.getByText("Envio realizado após o prazo")).toBeTruthy();
    expect(screen.getByText(/1 dia e 2 horas/)).toBeTruthy();
  });

  it("formata a duração de atraso de forma legível", () => {
    expect(formatSubmissionDelay(3_660)).toBe("1 hora e 1 minuto");
  });

  it("trata data inválida sem inventar um horário", () => {
    expect(formatSubmissionDateTime("inválida")).toBe("Data indisponível");
  });
});
