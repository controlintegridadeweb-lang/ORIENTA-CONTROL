import { describe, expect, it } from "vitest";

// Réplica das regras puras de loadOfficialReportData: resolução de versão + mapeamento.
type Proc = { id: string; processing_version: number; status: string };
function resolveTarget(procs: Proc[], version?: number): Proc | null {
  const completed = procs.filter((p) => p.status === "completed");
  if (version !== undefined) return completed.find((p) => p.processing_version === version) ?? null;
  return completed.sort((a, b) => b.processing_version - a.processing_version)[0] ?? null;
}
function mapMaturity(v: number | null): number | null {
  return v === null ? null : Number(v);
}

describe("official-report — resolução de versão", () => {
  const procs: Proc[] = [
    { id: "p1", processing_version: 1, status: "completed" },
    { id: "p2", processing_version: 2, status: "completed" },
    { id: "p3", processing_version: 3, status: "working" }, // reaberto, em aberto
  ];
  it("default = maior versão CONCLUÍDA (ignora working)", () => {
    expect(resolveTarget(procs)?.id).toBe("p2");
  });
  it("versão explícita pega a histórica preservada", () => {
    expect(resolveTarget(procs, 1)?.id).toBe("p1");
  });
  it("nunca resolve a working corrente, mesmo sendo a maior versão", () => {
    expect(resolveTarget(procs, 3)).toBeNull();
    expect(resolveTarget(procs)?.processing_version).toBe(2);
  });
  it("ciclo sem fechamento → null (vira 404)", () => {
    expect(resolveTarget([{ id: "w", processing_version: 1, status: "working" }])).toBeNull();
  });
  it("versão inexistente → null", () => {
    expect(resolveTarget(procs, 99)).toBeNull();
  });
});

describe("official-report — N/A é estado de 1ª classe (205)", () => {
  it("maturity_level null preserva null, não vira 0", () => {
    expect(mapMaturity(null)).toBeNull();
    expect(mapMaturity(3)).toBe(3);
  });
});
