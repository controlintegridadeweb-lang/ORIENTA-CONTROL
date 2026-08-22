import { RECOMMENDATION_TYPE_LABELS } from "@/shared/ui/status-registry";
import type {
  LibraryCatalogEntity,
  LibraryItemStatus,
  LibraryRecommendationType,
} from "./types";

type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "relation"
  | "tags";

type FieldMode = "basic" | "advanced";

type SelectOption = { value: string; label: string };

export type FieldSpec = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  min?: number;
  max?: number;
  options?: SelectOption[];
  relation?: { entity: "axes" };
  mode?: FieldMode;
  readOnlyOnEdit?: boolean;
};

export type ColumnSpec = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  width?: string;
};

export type EntityConfig = {
  entity: LibraryCatalogEntity;
  title: string;
  singular: string;
  addLabel: string;
  emptyLabel: string;
  columns: ColumnSpec[];
  fields: FieldSpec[];
};

export const LIBRARY_STATUS_LABEL: Record<LibraryItemStatus, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  published: "Publicado",
  deprecated: "Descontinuado",
  archived: "Arquivado",
};

export const LIBRARY_RECOMMENDATION_TYPE_LABEL: Record<LibraryRecommendationType, string> = {
  nao_implementacao: RECOMMENDATION_TYPE_LABELS.nao_implementacao,
  ausencia_evidencia: RECOMMENDATION_TYPE_LABELS.ausencia_evidencia,
  evidencia_insuficiente: RECOMMENDATION_TYPE_LABELS.evidencia_insuficiente,
};

const tagsField: FieldSpec = {
  key: "tags",
  label: "Tags",
  type: "tags",
  placeholder: "ex: governanca, lgpd",
  help: "Separe tags por virgula. Somente letras, numeros e hifens.",
};

const statusColumn: ColumnSpec = { key: "status", label: "Situação", width: "w-32" };
const versionColumn: ColumnSpec = { key: "version", label: "Versão", width: "w-24" };

const identifierField: FieldSpec = {
  key: "code",
  label: "Identificador interno",
  type: "text",
  required: false,
  placeholder: "Gerado automaticamente",
  help: "Gerado automaticamente. Ajuste apenas se precisar de um padrao manual.",
  mode: "advanced",
  readOnlyOnEdit: true,
};

const ordemField: FieldSpec = {
  key: "ordem",
  label: "Posicao na lista",
  type: "number",
  required: false,
  min: 0,
  max: 9999,
  help: "Definida automaticamente. Ajuste apenas para reordenar.",
  mode: "advanced",
};

export const LIBRARY_CONFIG: Record<LibraryCatalogEntity, EntityConfig> = {
  axes: {
    entity: "axes",
    title: "Eixos de avaliação",
    singular: "Eixo",
    addLabel: "Novo eixo",
    emptyLabel: "Nenhum eixo cadastrado.",
    columns: [
      { key: "code", label: "Código", width: "w-32" },
      { key: "name", label: "Nome" },
      statusColumn,
      versionColumn,
      { key: "description", label: "Descrição" },
      { key: "ordem", label: "Ordem", align: "right", width: "w-24" },
    ],
    fields: [
      { key: "name", label: "Nome", type: "text", required: true, mode: "basic" },
      { key: "description", label: "Descrição", type: "textarea", mode: "basic" },
      { ...tagsField, mode: "basic" },
      identifierField,
      ordemField,
    ],
  },
  sections: {
    entity: "sections",
    title: "Seções",
    singular: "Seção",
    addLabel: "Nova seção",
    emptyLabel: "Nenhuma seção cadastrada.",
    columns: [
      { key: "code", label: "Código", width: "w-32" },
      { key: "axisCode", label: "Eixo", width: "w-40" },
      { key: "name", label: "Nome" },
      statusColumn,
      versionColumn,
      { key: "description", label: "Descrição" },
      { key: "ordem", label: "Ordem", align: "right", width: "w-24" },
    ],
    fields: [
      {
        key: "axisId",
        label: "Eixo",
        type: "relation",
        required: true,
        relation: { entity: "axes" },
        mode: "basic",
      },
      { key: "name", label: "Nome", type: "text", required: true, mode: "basic" },
      { key: "description", label: "Descrição", type: "textarea", mode: "basic" },
      { ...tagsField, mode: "basic" },
      identifierField,
      ordemField,
    ],
  },
  /**
   * Modelos de texto de recomendação: domínio e API (`/api/admin/library/recommendations`)
   * permanecem ativos. Não fazem parte da Biblioteca Geral (só seções ESG).
   * Precisam de uma tela administrativa própria quando forem reexpostos na UI.
   */
  recommendations: {
    entity: "recommendations",
    title: "Modelos de recomendação (texto)",
    singular: "Modelo de recomendação",
    addLabel: "Novo modelo de recomendação",
    emptyLabel: "Nenhum modelo de recomendação cadastrado.",
    columns: [
      { key: "code", label: "Código", width: "w-32" },
      { key: "title", label: "Título" },
      statusColumn,
      versionColumn,
      { key: "tipo", label: "Tipo", width: "w-40" },
      { key: "description", label: "Descrição" },
    ],
    fields: [
      { key: "title", label: "Título", type: "text", required: true, mode: "basic" },
      { key: "description", label: "Descrição", type: "textarea", mode: "basic" },
      {
        key: "tipo",
        label: "Tipo de recomendação",
        type: "select",
        required: false,
        options: Object.entries(LIBRARY_RECOMMENDATION_TYPE_LABEL).map(([value, label]) => ({
          value,
          label,
        })),
        help: "Se vazio, o padrão ao salvar é não implementação.",
        mode: "basic",
      },
      {
        key: "textoBaseFixo",
        label: "Texto-base fixo",
        type: "textarea",
        mode: "advanced",
        help: "Complemento de texto reutilizável (o motor junta com o título e blocos opcionais).",
      },
      {
        key: "textoBaseParametrizavel",
        label: "Texto parametrizável",
        type: "textarea",
        placeholder: "Ex.: Aplique em {{organizacao}}",
        mode: "advanced",
      },
      {
        key: "fundamentoTecnico",
        label: "Fundamento técnico",
        type: "textarea",
        mode: "advanced",
      },
      {
        key: "escopoAplicacao",
        label: "Escopo de aplicação",
        type: "textarea",
        mode: "advanced",
      },
      { ...tagsField, mode: "basic" },
      identifierField,
    ],
  },
};
