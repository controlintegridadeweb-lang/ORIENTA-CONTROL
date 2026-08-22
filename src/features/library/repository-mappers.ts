import type {
  LibraryCommonFields,
  LibraryItemStatus,
  LibraryItemVersion,
  LibraryItemType,
  LibraryParameterVariable,
  LibraryRecommendationType,
  LibraryRecommendationBase,
  LibrarySection,
} from "./types";
import { axisCodeFromName } from "@/features/library/domain/fixed-axes";

export type VersionedLibraryTable =
  | "sections"
  | "library_recommendations";

type CommonRow = {
  status: LibraryItemStatus | null;
  version_major: number | null;
  version_minor: number | null;
  version_patch: number | null;
  vigente_de: string | null;
  vigente_ate: string | null;
  tags: string[] | null;
  created_by: string | null;
  updated_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  deprecated_by: string | null;
  deprecated_at: string | null;
};

export type SectionRow = CommonRow & {
  id: string;
  axis_id: string;
  code: string;
  name: string;
  description: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
  axes: { name: string } | { name: string }[] | null;
};

export const SECTIONS_TABLE = "sections";
export const SECTIONS_AXIS_FK = "axes!inner(name)";

export type RecommendationRow = CommonRow & {
  id: string;
  code: string;
  title: string;
  description: string | null;
  tipo: LibraryRecommendationType | null;
  texto_base_fixo: string | null;
  texto_base_parametrizavel: string | null;
  variaveis_parametro: unknown;
  fundamento_tecnico: string | null;
  escopo_aplicacao: string | null;
  created_at: string;
  updated_at: string;
};

function mapCommon(row: CommonRow): LibraryCommonFields {
  const versionMajor = row.version_major ?? 0;
  const versionMinor = row.version_minor ?? 1;
  const versionPatch = row.version_patch ?? 0;
  return {
    status: row.status ?? "draft",
    versionMajor,
    versionMinor,
    versionPatch,
    version: `${versionMajor}.${versionMinor}.${versionPatch}`,
    vigenteDe: row.vigente_de,
    vigenteAte: row.vigente_ate,
    tags: row.tags ?? [],
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    deprecatedBy: row.deprecated_by,
    deprecatedAt: row.deprecated_at,
  };
}

export function commonInsertPayload(
  input: { status?: string | undefined; tags?: string[] | undefined },
  actorUserId?: string | null,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (input.status) payload.status = input.status;
  if (input.tags) payload.tags = input.tags;
  if (actorUserId) {
    payload.created_by = actorUserId;
    payload.updated_by = actorUserId;
  }
  return payload;
}

export function commonUpdatePayload(
  input: { status?: string | undefined; tags?: string[] | undefined },
  actorUserId?: string | null,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (input.status !== undefined) payload.status = input.status;
  if (input.tags !== undefined) payload.tags = input.tags ?? [];
  if (actorUserId) payload.updated_by = actorUserId;
  return payload;
}

function parseParameters(raw: unknown): LibraryParameterVariable[] {
  if (!Array.isArray(raw)) return [];
  const out: LibraryParameterVariable[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const value = entry as Record<string, unknown>;
    const key = typeof value.key === "string" ? value.key : null;
    const label = typeof value.label === "string" ? value.label : null;
    if (!key || !label) continue;
    const exemplo = typeof value.exemplo === "string" ? value.exemplo : null;
    out.push({ key, label, exemplo });
  }
  return out;
}

export function mapSection(row: SectionRow): LibrarySection {
  const axisRel = Array.isArray(row.axes) ? row.axes[0] : row.axes;
  const axisName = axisRel?.name ?? "";
  return {
    ...mapCommon(row),
    id: row.id,
    axisId: row.axis_id,
    axisCode: axisName ? axisCodeFromName(axisName) : "",
    code: row.code,
    name: row.name,
    description: row.description,
    ordem: row.ordem,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRecommendation(row: RecommendationRow): LibraryRecommendationBase {
  return {
    ...mapCommon(row),
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    tipo: row.tipo ?? "nao_implementacao",
    textoBaseFixo: row.texto_base_fixo,
    textoBaseParametrizavel: row.texto_base_parametrizavel,
    variaveisParametro: parseParameters(row.variaveis_parametro),
    fundamentoTecnico: row.fundamento_tecnico,
    escopoAplicacao: row.escopo_aplicacao,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ItemVersionRow = {
  id: string;
  item_type: LibraryItemType;
  item_id: string;
  version: string;
  version_major: number;
  version_minor: number;
  version_patch: number;
  payload: unknown;
  hash: string;
  vigente_de: string;
  vigente_ate: string | null;
  previous_version_id: string | null;
  published_by: string | null;
  published_at: string;
  deprecated_by: string | null;
  deprecated_at: string | null;
  created_at: string;
};

export function mapItemVersion(row: ItemVersionRow): LibraryItemVersion {
  return {
    id: row.id,
    itemType: row.item_type,
    itemId: row.item_id,
    version: row.version,
    versionMajor: row.version_major,
    versionMinor: row.version_minor,
    versionPatch: row.version_patch,
    payload:
      row.payload && typeof row.payload === "object"
        ? (row.payload as Record<string, unknown>)
        : {},
    hash: row.hash,
    vigenteDe: row.vigente_de,
    vigenteAte: row.vigente_ate,
    previousVersionId: row.previous_version_id,
    publishedBy: row.published_by,
    publishedAt: row.published_at,
    deprecatedBy: row.deprecated_by,
    deprecatedAt: row.deprecated_at,
    createdAt: row.created_at,
  };
}

export type LibraryActorContext = { userId?: string | null };
