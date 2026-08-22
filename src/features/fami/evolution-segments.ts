export type EvolutionValuePoint = {
  index: number;
  value: number;
};

/**
 * Divide uma série em trechos aplicáveis. Valores N/A encerram o trecho atual
 * e impedem qualquer linha ou área visual de atravessar o período sem resultado.
 */
export function splitApplicableEvolutionSegments(
  values: ReadonlyArray<number | null>,
): EvolutionValuePoint[][] {
  const segments: EvolutionValuePoint[][] = [];
  let current: EvolutionValuePoint[] = [];

  values.forEach((value, index) => {
    if (value == null || Number.isNaN(value)) {
      if (current.length > 0) segments.push(current);
      current = [];
      return;
    }
    current.push({ index, value });
  });

  if (current.length > 0) segments.push(current);
  return segments;
}
