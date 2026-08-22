// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "./use-debounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("atrasia atualizacao pelo delay configurado", () => {
    const { result, rerender } = renderHook(
      ({ v, ms }: { v: string; ms: number }) => useDebounce(v, ms),
      { initialProps: { v: "a", ms: 250 } },
    );
    expect(result.current).toBe("a");

    rerender({ v: "b", ms: 250 });
    expect(result.current).toBe("a");
    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(result.current).toBe("a");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("b");
  });
});
