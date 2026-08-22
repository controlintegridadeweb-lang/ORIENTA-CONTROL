export type LibraryItemStatus =
  | "draft"
  | "in_review"
  | "published"
  | "deprecated"
  | "archived";

export type LibraryRecommendationType =
  | "nao_implementacao"
  | "ausencia_evidencia"
  | "evidencia_insuficiente";

/** Entidades do catálogo. Eixos são fixos; a manutenção começa em Seções. */
export type LibraryCatalogEntity = "axes" | "sections" | "recommendations";

export type LibraryItemType = "axis" | "section" | "recommendation";

export type LibraryParameterVariable = {
  key: string;
  label: string;
  exemplo?: string | null;
};

export type LibraryCommonFields = {
  status: LibraryItemStatus;
  versionMajor: number;
  versionMinor: number;
  versionPatch: number;
  version: string;
  vigenteDe: string | null;
  vigenteAte: string | null;
  tags: string[];
  createdBy: string | null;
  updatedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  deprecatedBy: string | null;
  deprecatedAt: string | null;
};

export type LibraryAxis = LibraryCommonFields & {
  id: string;
  code: string;
  name: string;
  description: string | null;
  ordem: number;
  createdAt: string;
  updatedAt: string;
};

export type LibrarySection = LibraryCommonFields & {
  id: string;
  axisId: string;
  axisCode: string;
  code: string;
  name: string;
  description: string | null;
  ordem: number;
  createdAt: string;
  updatedAt: string;
};

export type LibraryRecommendationBase = LibraryCommonFields & {
  id: string;
  code: string;
  title: string;
  description: string | null;
  tipo: LibraryRecommendationType;
  textoBaseFixo: string | null;
  textoBaseParametrizavel: string | null;
  variaveisParametro: LibraryParameterVariable[];
  fundamentoTecnico: string | null;
  escopoAplicacao: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LibraryCatalogItem =
  | LibraryAxis
  | LibrarySection
  | LibraryRecommendationBase;

/** Snapshot usado pela tela Biblioteca Geral. */
export type LibraryCatalogSnapshot = {
  axes: LibraryAxis[];
  sections: LibrarySection[];
  recommendations: LibraryRecommendationBase[];
};


export type LibraryItemVersion = {
  id: string;
  itemType: LibraryItemType;
  itemId: string;
  version: string;
  versionMajor: number;
  versionMinor: number;
  versionPatch: number;
  payload: Record<string, unknown>;
  hash: string;
  vigenteDe: string;
  vigenteAte: string | null;
  previousVersionId: string | null;
  publishedBy: string | null;
  publishedAt: string;
  deprecatedBy: string | null;
  deprecatedAt: string | null;
  createdAt: string;
};

export const LIBRARY_CATALOG_ENTITIES: readonly LibraryCatalogEntity[] = [
  "axes",
  "sections",
  "recommendations",
] as const;

export const LIBRARY_ITEM_TYPE_BY_ENTITY: Record<LibraryCatalogEntity, LibraryItemType> = {
  axes: "axis",
  sections: "section",
  recommendations: "recommendation",
};

export const LIBRARY_ITEM_STATUSES: readonly LibraryItemStatus[] = [
  "draft",
  "in_review",
  "published",
  "deprecated",
  "archived",
] as const;

export const LIBRARY_RECOMMENDATION_TYPES: readonly LibraryRecommendationType[] = [
  "nao_implementacao",
  "ausencia_evidencia",
  "evidencia_insuficiente",
] as const;
