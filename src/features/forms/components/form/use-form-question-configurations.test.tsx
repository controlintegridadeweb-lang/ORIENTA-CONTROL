// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultConfiguration } from "./form-questions-configurator-helpers";

const mocks = vi.hoisted(() => ({
  fetchQuestionConfiguration: vi.fn(),
  saveQuestionConfiguration: vi.fn(),
}));

vi.mock("@/features/library/client", () => ({
  fetchQuestionConfiguration: mocks.fetchQuestionConfiguration,
  saveQuestionConfiguration: mocks.saveQuestionConfiguration,
}));

import { useFormQuestionConfigurations } from "./use-form-question-configurations";

const question = {
  id: "question-1",
  prompt: "A organização possui política formal?",
  sectionId: "section-1",
  requiresEvidence: true,
  allowsNotApplicable: false,
  orderIndex: 0,
};

describe("useFormQuestionConfigurations", () => {
  beforeEach(() => {
    mocks.fetchQuestionConfiguration.mockReset();
    mocks.saveQuestionConfiguration.mockReset();
  });

  it("não cria configuração editável quando o carregamento remoto falha", async () => {
    mocks.fetchQuestionConfiguration.mockRejectedValueOnce(new Error("rede indisponível"));
    const setError = vi.fn();

    const { result } = renderHook(() =>
      useFormQuestionConfigurations({
        formId: "form-1",
        questions: [question],
        expandedQuestionId: null,
        setError,
      }),
    );

    await act(async () => {
      await result.current.retryConfiguration(question);
    });

    await waitFor(() => {
      expect(result.current.failedConfigIds.has(question.id)).toBe(true);
    });

    expect(result.current.loadedConfigIds.has(question.id)).toBe(false);
    expect(result.current.configByQuestion[question.id]).toBeUndefined();
    expect(setError).toHaveBeenCalledWith("rede indisponível");
  });

  it("libera a edição somente depois de uma nova leitura bem-sucedida", async () => {
    mocks.fetchQuestionConfiguration.mockRejectedValueOnce(new Error("falha temporária"));
    const setError = vi.fn();

    const { result } = renderHook(() =>
      useFormQuestionConfigurations({
        formId: "form-1",
        questions: [question],
        expandedQuestionId: null,
        setError,
      }),
    );

    await act(async () => {
      await result.current.retryConfiguration(question);
    });

    await waitFor(() => {
      expect(result.current.failedConfigIds.has(question.id)).toBe(true);
    });

    const configuration = createDefaultConfiguration(
      question.id,
      question.prompt,
      question.sectionId,
    );
    mocks.fetchQuestionConfiguration.mockResolvedValueOnce(configuration);

    await act(async () => {
      await result.current.retryConfiguration(question);
    });

    expect(result.current.failedConfigIds.has(question.id)).toBe(false);
    expect(result.current.loadedConfigIds.has(question.id)).toBe(true);
    expect(result.current.configByQuestion[question.id]).toEqual(configuration);
  });

  it("materializa a configuração padrão quando o binding ainda não existe", async () => {
    mocks.fetchQuestionConfiguration.mockResolvedValueOnce(null);
    const setError = vi.fn();

    const { result } = renderHook(() =>
      useFormQuestionConfigurations({
        formId: "form-1",
        questions: [question],
        expandedQuestionId: question.id,
        setError,
      }),
    );

    await waitFor(() => {
      expect(result.current.loadedConfigIds.has(question.id)).toBe(true);
    });

    const loaded = result.current.configByQuestion[question.id];
    expect(loaded).toMatchObject({
      questionId: question.id,
      sectionId: question.sectionId,
      bindings: {},
      responseMapping: {},
      coverageScore: 0,
      metric: {
        answerType: "yes_no",
        interpretation: "qualitative",
      },
    });
    expect(result.current.failedConfigIds.has(question.id)).toBe(false);
    expect(setError.mock.calls.every(([message]) => message === null)).toBe(true);
  });
});
