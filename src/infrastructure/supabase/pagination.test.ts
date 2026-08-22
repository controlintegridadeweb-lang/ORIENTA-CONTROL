import { describe, expect, it } from "vitest";
import { chunkValues, collectPostgrestPages } from "./pagination";

describe("paginação PostgREST", () => {
  it("continua lendo quando o servidor devolve páginas menores que o intervalo solicitado", async () => {
    const source = [1, 2, 3, 4, 5];
    const calls: Array<[number, number]> = [];

    const result = await collectPostgrestPages<number>(async (from, to) => {
      calls.push([from, to]);
      const serverPageSize = 2;
      return {
        data: source.slice(from, Math.min(from + serverPageSize, to + 1)),
        error: null,
      };
    });

    expect(result).toEqual(source);
    expect(calls.map(([from]) => from)).toEqual([0, 2, 4, 5]);
  });

  it("divide filtros IN em blocos sem perder valores", () => {
    expect(chunkValues([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
