// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VALIDATION_AUTOSAVE_TEXT_DEBOUNCE_MS } from "./validation-analysis-autosave";
import { useValidationAnalysisAutosave } from "./use-validation-analysis-autosave";

describe("useValidationAnalysisAutosave", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("respeita debounce textual e não dispara durante o intervalo", () => {
    vi.useFakeTimers();
    const action = vi.fn();
    const { result } = renderHook(() => useValidationAnalysisAutosave());

    act(() => {
      result.current.scheduleTextAutosave("evidence:1", action);
      result.current.scheduleTextAutosave("evidence:1", action);
    });

    expect(action).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(VALIDATION_AUTOSAVE_TEXT_DEBOUNCE_MS - 1);
    });
    expect(action).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(action).toHaveBeenCalledTimes(1);
  });
});
