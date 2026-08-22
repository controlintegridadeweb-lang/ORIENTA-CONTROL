// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { buildPageNumbers, usePagination } from "./use-pagination";

describe("buildPageNumbers", () => {
  it("lista todas as páginas quando são poucas (<= 7)", () => {
    expect(buildPageNumbers(1, 1)).toEqual([1]);
    expect(buildPageNumbers(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("insere reticências e preserva primeira/última em listas longas", () => {
    expect(buildPageNumbers(1, 10)).toEqual([1, 2, "ellipsis", 10]);
    expect(buildPageNumbers(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
    expect(buildPageNumbers(10, 10)).toEqual([1, "ellipsis", 9, 10]);
  });
});

describe("usePagination", () => {
  it("calcula totais, faixa e recorte da primeira página", () => {
    const { result } = renderHook(() => usePagination({ totalItems: 22 }));

    expect(result.current.page).toBe(1);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.pageItemCount).toBe(10);
    expect(result.current.rangeStart).toBe(1);
    expect(result.current.rangeEnd).toBe(10);
    expect(result.current.canPrevious).toBe(false);
    expect(result.current.canNext).toBe(true);

    const items = Array.from({ length: 22 }, (_, i) => i + 1);
    expect(result.current.pageItems(items)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("navega e recorta a última página (parcial)", () => {
    const { result } = renderHook(() => usePagination({ totalItems: 22 }));
    const items = Array.from({ length: 22 }, (_, i) => i + 1);

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);
    expect(result.current.pageItemCount).toBe(2);
    expect(result.current.rangeStart).toBe(21);
    expect(result.current.rangeEnd).toBe(22);
    expect(result.current.canNext).toBe(false);
    expect(result.current.pageItems(items)).toEqual([21, 22]);
  });

  it("limita a navegação aos limites válidos", () => {
    const { result } = renderHook(() => usePagination({ totalItems: 22 }));

    act(() => result.current.goToPrevious());
    expect(result.current.page).toBe(1);

    act(() => result.current.setPage(999));
    expect(result.current.page).toBe(3);

    act(() => result.current.goToNext());
    expect(result.current.page).toBe(3);
  });

  it("volta para a primeira página quando resetKey muda (filtros/busca)", () => {
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) => usePagination({ totalItems: 22, resetKey: key }),
      { initialProps: { key: "todos" } },
    );

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    rerender({ key: "busca:abc" });
    expect(result.current.page).toBe(1);
  });

  it("aterrissa na última página quando o total cresce após setPage (ex.: item adicionado)", () => {
    const { result, rerender } = renderHook(
      ({ total }: { total: number }) => usePagination({ totalItems: total }),
      { initialProps: { total: 20 } },
    );

    // Pede a "próxima" página antes de o item entrar no total (total antigo = 2 páginas).
    act(() => result.current.setPage(result.current.totalPages + 1));
    rerender({ total: 21 });

    expect(result.current.totalPages).toBe(3);
    expect(result.current.page).toBe(3);
    expect(result.current.pageItemCount).toBe(1);
  });

  it("mantém a página válida quando o total encolhe", () => {
    const { result, rerender } = renderHook(
      ({ total }: { total: number }) => usePagination({ totalItems: total }),
      { initialProps: { total: 22 } },
    );

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    rerender({ total: 5 });
    expect(result.current.totalPages).toBe(1);
    expect(result.current.page).toBe(1);
  });

  it("respeita página controlada pela URL e acompanha voltar/avançar", () => {
    const { result, rerender } = renderHook(
      ({ page }: { page: number }) => usePagination({ totalItems: 42, page }),
      { initialProps: { page: 3 } },
    );

    expect(result.current.page).toBe(3);
    expect(result.current.rangeStart).toBe(21);

    rerender({ page: 1 });
    expect(result.current.page).toBe(1);

    rerender({ page: 99 });
    expect(result.current.page).toBe(5);
  });

  it("trata conjunto vazio sem quebrar", () => {
    const { result } = renderHook(() => usePagination({ totalItems: 0 }));

    expect(result.current.totalPages).toBe(1);
    expect(result.current.page).toBe(1);
    expect(result.current.pageItemCount).toBe(0);
    expect(result.current.rangeStart).toBe(0);
    expect(result.current.rangeEnd).toBe(0);
    expect(result.current.canPrevious).toBe(false);
    expect(result.current.canNext).toBe(false);
    expect(result.current.pageItems([])).toEqual([]);
  });
});
