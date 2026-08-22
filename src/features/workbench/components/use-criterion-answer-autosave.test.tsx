// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTOSAVE_TEXT_DEBOUNCE_MS } from "./criterion-answer-autosave";
import { useCriterionAnswerAutosave } from "./use-criterion-answer-autosave";

describe("useCriterionAnswerAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("aplica debounce textual entre 500 e 800 ms", () => {
    const action = vi.fn();
    const { result } = renderHook(() => useCriterionAnswerAutosave());

    act(() => {
      result.current.scheduleTextAutosave("q-1", action);
      result.current.scheduleTextAutosave("q-1", action);
    });

    expect(action).not.toHaveBeenCalled();
    expect(result.current.hasPendingTextAutosave).toBe(true);

    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_TEXT_DEBOUNCE_MS - 1);
    });
    expect(action).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.hasPendingTextAutosave).toBe(false);
  });

  it("aviso de saída permanece enquanto houver salvamento pendente", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { result, unmount } = renderHook(() => useCriterionAnswerAutosave());

    act(() => {
      result.current.markSaving("q-1");
    });

    expect(add).toHaveBeenCalledWith("beforeunload", expect.any(Function));

    act(() => {
      result.current.markSaved("q-1");
    });
    expect(result.current.hasUnconfirmedAutosave).toBe(false);

    unmount();
    expect(remove).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });
});
