"use client";

import { useMemo, useState } from "react";

/** Quantidade padrão de registros por página nas listagens do sistema. */
const DEFAULT_PAGE_SIZE = 10;

/** Item da barra de números: uma página concreta ou reticências de corte. */
export type PageNumberItem = number | "ellipsis";

export type PaginationState = {
  /** Página atual já normalizada (1 ≤ page ≤ totalPages). */
  page: number;
  pageSize: number;
  /** Total de itens do conjunto já filtrado/ordenado. */
  totalItems: number;
  totalPages: number;
  /** Índice 0-based inclusivo do primeiro item da página (para slice). */
  startIndex: number;
  /** Índice 0-based exclusivo do fim da página (para slice). */
  endIndex: number;
  /** Posição 1-based do primeiro item exibido (0 quando não há itens). */
  rangeStart: number;
  /** Posição 1-based do último item exibido (0 quando não há itens). */
  rangeEnd: number;
  /** Quantidade de itens exibidos na página atual. */
  pageItemCount: number;
  canPrevious: boolean;
  canNext: boolean;
  pageNumbers: PageNumberItem[];
  setPage: (page: number) => void;
  goToPrevious: () => void;
  goToNext: () => void;
  /** Recorta a fatia da página atual de um array já filtrado/ordenado. */
  pageItems: <T>(items: readonly T[]) => T[];
};

type UsePaginationOptions = {
  /** Total de itens do conjunto já filtrado/ordenado. */
  totalItems: number;
  /** Registros por página (padrão: {@link DEFAULT_PAGE_SIZE}). */
  pageSize?: number;
  /**
   * Chave que representa os filtros/busca/ordenação aplicados. Quando muda, a
   * paginação volta para a primeira página — preservando (e não "brigando" com)
   * qualquer filtro já aplicado pela listagem.
   */
  resetKey?: string | number;
  /** Página inicial restaurada da URL. */
  initialPage?: number;
  /** Página controlada por uma fonte externa, como os parâmetros da URL. */
  page?: number;
};

/**
 * Monta a sequência de números de página com reticências para conjuntos longos.
 * Mantém sempre a primeira, a última e a janela ao redor da página atual.
 */
export function buildPageNumbers(currentPage: number, totalPages: number): PageNumberItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const sorted = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  const withEllipsis: PageNumberItem[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const page = sorted[index];
    const previous = sorted[index - 1];
    if (index > 0 && previous !== undefined && page - previous > 1) {
      withEllipsis.push("ellipsis");
    }
    withEllipsis.push(page);
  }
  return withEllipsis;
}

/**
 * Paginação puramente client-side sobre um conjunto já filtrado/ordenado.
 *
 * Não conhece os dados: recebe apenas o total e devolve os índices/estado para
 * recortar a página. Assim serve a qualquer listagem — a fonte permanece
 * responsável por busca, filtros e ordenação, e a paginação apenas os respeita.
 */
export function usePagination({
  totalItems,
  pageSize = DEFAULT_PAGE_SIZE,
  resetKey,
  initialPage = 1,
  page: controlledPage,
}: UsePaginationOptions): PaginationState {
  const safePageSize = Math.max(1, Math.trunc(pageSize));
  const [rawPage, setRawPage] = useState(() => Math.max(1, Math.trunc(initialPage)));
  const [lastResetKey, setLastResetKey] = useState(resetKey);

  // Reset ao mudar filtros/busca/ordenação: ajuste de estado durante o render
  // (padrão oficial do React), evitando um efeito extra e flicker de página.
  if (controlledPage == null && resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setRawPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalItems) / safePageSize));
  const requestedPage = controlledPage == null
    ? rawPage
    : Math.max(1, Math.trunc(controlledPage));
  const page = Math.min(Math.max(1, requestedPage), totalPages);

  const startIndex = (page - 1) * safePageSize;
  const endIndex = Math.min(startIndex + safePageSize, Math.max(0, totalItems));
  const pageItemCount = Math.max(0, endIndex - startIndex);

  const pageNumbers = useMemo(() => buildPageNumbers(page, totalPages), [page, totalPages]);

  // Não trava no limite superior: `page` (derivado) já faz o clamp. Assim,
  // pedir "ir para a última página" continua correto mesmo quando o total ainda
  // vai crescer no mesmo ciclo de render (ex.: logo após adicionar um item).
  function setPage(next: number) {
    setRawPage(Math.max(1, Math.trunc(next)));
  }

  return {
    page,
    pageSize: safePageSize,
    totalItems: Math.max(0, totalItems),
    totalPages,
    startIndex,
    endIndex,
    rangeStart: pageItemCount === 0 ? 0 : startIndex + 1,
    rangeEnd: endIndex,
    pageItemCount,
    canPrevious: page > 1,
    canNext: page < totalPages,
    pageNumbers,
    setPage,
    goToPrevious: () => setRawPage(Math.max(1, page - 1)),
    goToNext: () => setRawPage(Math.min(totalPages, page + 1)),
    pageItems: <T,>(items: readonly T[]): T[] => items.slice(startIndex, startIndex + safePageSize),
  };
}
