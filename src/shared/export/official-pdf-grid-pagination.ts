export type GridPageBatch = {
  start: number;
  end: number;
  newPageBefore: boolean;
};

function resolveGridSpans(rowCount: number, spans?: readonly number[]): number[] {
  if (rowCount <= 0) return [];
  if (!spans || spans.length === 0) return [rowCount];
  const valid =
    spans.every((span) => span > 0) && spans.reduce((sum, span) => sum + span, 0) === rowCount;
  return valid ? [...spans] : [rowCount];
}

/**
 * A recomendação só muda de página junto do plano quando ela mesma não cabe
 * e a sequência inteira ainda cabe numa página nova.
 */
export function shouldStartPageBeforePreface(
  remaining: number,
  pageCapacity: number,
  prefaceReserve: number,
  followingReserve: number,
): boolean {
  if (prefaceReserve <= remaining) return false;
  return prefaceReserve + followingReserve <= pageCapacity;
}

/**
 * Agrupa linhas para cada bloco desenhado, sem deixar sobras de uma ação
 * virarem tabelas soltas no rodapé ou na página seguinte.
 */
export function planGridPageBatches(
  heights: readonly number[],
  spans: readonly number[],
  firstAvailable: number,
  pageAvailable: number,
): GridPageBatch[] {
  const groups: Array<{ start: number; end: number; height: number }> = [];
  let offset = 0;
  for (const span of resolveGridSpans(heights.length, spans)) {
    const end = offset + span;
    const height = heights.slice(offset, end).reduce((sum, value) => sum + value, 0);
    groups.push({ start: offset, end, height });
    offset = end;
  }

  const batches: GridPageBatch[] = [];
  let remaining = firstAvailable;
  let batchStart = -1;
  let batchEnd = -1;
  let newPageBefore = false;

  const commit = () => {
    if (batchStart < 0) return;
    batches.push({ start: batchStart, end: batchEnd, newPageBefore });
    batchStart = -1;
    batchEnd = -1;
    newPageBefore = false;
  };

  const append = (start: number, end: number) => {
    if (batchStart < 0) batchStart = start;
    batchEnd = end;
  };

  const startNewPage = () => {
    commit();
    newPageBefore = true;
    remaining = pageAvailable;
  };

  for (const group of groups) {
    if (group.height > remaining) {
      const onFreshPage = batchStart < 0 && remaining >= pageAvailable - 0.5;
      if (!onFreshPage) startNewPage();
    }

    if (group.height <= remaining) {
      append(group.start, group.end);
      remaining -= group.height;
      continue;
    }

    for (let row = group.start; row < group.end; row += 1) {
      const height = heights[row]!;
      if (batchStart >= 0 && height > remaining) startNewPage();
      append(row, row + 1);
      remaining = Math.max(0, remaining - height);
    }
  }
  commit();
  return batches;
}
