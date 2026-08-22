const POSTGREST_PAGE_SIZE = 1000;
const POSTGREST_IN_FILTER_CHUNK_SIZE = 200;

export function chunkValues<T>(values: readonly T[], size = POSTGREST_IN_FILTER_CHUNK_SIZE): T[][] {
  if (size < 1) throw new Error("O tamanho do bloco deve ser positivo.");
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export async function collectPostgrestPages<T>(
  loadPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = POSTGREST_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await loadPage(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length === 0) return rows;
    offset += page.length;
  }
}
