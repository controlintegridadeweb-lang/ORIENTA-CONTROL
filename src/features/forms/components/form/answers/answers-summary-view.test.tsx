// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  AnswersSummaryView,
  paginateAnswersSummaryQuestions,
  parseAnswersSummaryPage,
} from "./answers-summary-view";
import type { AnswersSummary } from "@/features/forms/answers-types";

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  pathname: "/admin/formularios/form-1/respostas",
  params: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.params,
}));

function buildSummary(questionCount: number): AnswersSummary {
  return {
    formId: "form-1",
    totalRespondents: 3,
    questions: Array.from({ length: questionCount }, (_, index) => ({
      questionId: `q-${index + 1}`,
      orderIndex: index,
      prompt: `Pergunta ${index + 1}`,
      answerType: "yes_no" as const,
      totalResponses: 3,
      distribution: { yes: 2, no: 1, not_applicable: 0 },
    })),
  };
}

describe("paginateAnswersSummaryQuestions", () => {
  it("pagina 10 perguntas por página e preserva a ordem", () => {
    const questions = buildSummary(12).questions;
    const page1 = paginateAnswersSummaryQuestions(questions, 1, 10);
    expect(page1.pageQuestions.map((q) => q.questionId)).toEqual(
      Array.from({ length: 10 }, (_, i) => `q-${i + 1}`),
    );
    expect(page1.totalPages).toBe(2);
    expect(page1.rangeStart).toBe(1);
    expect(page1.rangeEnd).toBe(10);

    const page2 = paginateAnswersSummaryQuestions(questions, 2, 10);
    expect(page2.pageQuestions.map((q) => q.questionId)).toEqual(["q-11", "q-12"]);
    expect(page2.rangeStart).toBe(11);
    expect(page2.rangeEnd).toBe(12);
  });

  it("normaliza página inválida", () => {
    expect(parseAnswersSummaryPage(null)).toBe(1);
    expect(parseAnswersSummaryPage("abc")).toBe(1);
    expect(parseAnswersSummaryPage("2")).toBe(2);
    const clamped = paginateAnswersSummaryQuestions(buildSummary(5).questions, 99, 10);
    expect(clamped.safePage).toBe(1);
  });
});

describe("AnswersSummaryView", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    navigation.replace.mockReset();
    navigation.params = new URLSearchParams();
  });

  it("não renderiza todas as perguntas de uma vez", () => {
    render(<AnswersSummaryView summary={buildSummary(12)} />);

    expect(screen.getByText("Pergunta 1")).toBeTruthy();
    expect(screen.getByText("Pergunta 10")).toBeTruthy();
    expect(screen.queryByText("Pergunta 11")).toBeNull();
    expect(screen.getByLabelText("Paginação do resumo de respostas")).toBeTruthy();
  });

  it("atualiza a URL ao mudar de página", () => {
    render(<AnswersSummaryView summary={buildSummary(12)} />);
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(navigation.replace).toHaveBeenCalledWith(
      "/admin/formularios/form-1/respostas?page=2",
      { scroll: false },
    );
  });
});
