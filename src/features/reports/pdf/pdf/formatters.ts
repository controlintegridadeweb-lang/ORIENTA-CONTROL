/** Formatadores centralizados de apresentação do PDF (sem regra de negócio). */

export function formatReportPercentage(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export function formatReportPoints(
  obtained: number | null | undefined,
  possible: number | null | undefined,
): string {
  if (obtained == null || possible == null) return "—";
  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${fmt(obtained)} / ${fmt(possible)}`;
}

export function formatReportInteger(value: number): string {
  return value.toLocaleString("pt-BR");
}

export function documentDisplayLine(params: {
  title: string;
  kind: "file" | "link";
  statusLabel: string;
  filename: string | null;
}): string {
  const kindLabel = params.kind === "link" ? "Link" : "Arquivo";
  const name = params.title.trim() || params.filename?.trim() || "Comprovante";
  return `${name} · ${kindLabel} · ${params.statusLabel}`;
}
