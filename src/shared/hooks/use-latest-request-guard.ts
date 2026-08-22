"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Garante que apenas a requisição assíncrona mais recente possa publicar
 * resultado, erro ou estado de loading no componente.
 */
export function useLatestRequestGuard() {
  const sequenceRef = useRef(0);

  const begin = useCallback(() => {
    sequenceRef.current += 1;
    return sequenceRef.current;
  }, []);

  const isLatest = useCallback(
    (requestId: number) => sequenceRef.current === requestId,
    [],
  );

  const invalidate = useCallback(() => {
    sequenceRef.current += 1;
  }, []);

  useEffect(() => invalidate, [invalidate]);

  return { begin, isLatest, invalidate };
}
