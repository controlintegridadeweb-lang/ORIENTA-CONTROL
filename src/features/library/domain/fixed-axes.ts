import type { LibraryAxis, LibraryCommonFields } from "@/features/library/types";

/** Código sintético para eixo fixo (tabela `axes` não tem coluna code). */
export function axisCodeFromName(name: string): string {
  const n = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  if (n.startsWith("govern")) return "GOV";
  if (n.startsWith("ambi")) return "AMB";
  if (n.startsWith("soc")) return "SOC";
  return name.slice(0, 3).toUpperCase();
}

const FIXED_AXIS_COMMON: LibraryCommonFields = {
  status: "published",
  versionMajor: 0,
  versionMinor: 1,
  versionPatch: 0,
  version: "0.1.0",
  vigenteDe: null,
  vigenteAte: null,
  tags: [],
  createdBy: null,
  updatedBy: null,
  approvedBy: null,
  approvedAt: null,
  deprecatedBy: null,
  deprecatedAt: null,
};

export function mapFixedAxisRow(
  row: { id: string; name: string },
  ordem: number,
): LibraryAxis {
  return {
    ...FIXED_AXIS_COMMON,
    id: row.id,
    code: axisCodeFromName(row.name),
    name: row.name,
    description: null,
    ordem,
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z",
  };
}

export const ESG_AXIS_MUTATION_FORBIDDEN =
  "Eixos ESG são fixos e imutáveis. Não é permitido cadastrar, editar ou excluir eixos.";
