import { z } from "zod";
import {
  LIBRARY_CATALOG_ENTITIES,
  LIBRARY_ITEM_STATUSES,
  LIBRARY_RECOMMENDATION_TYPES,
  type LibraryCatalogEntity,
} from "./types";

const codeSchema = z
  .string()
  .trim()
  .min(2, "Codigo deve ter no minimo 2 caracteres.")
  .max(40, "Codigo deve ter no maximo 40 caracteres.")
  .regex(/^[A-Z0-9][A-Z0-9_-]*$/i, "Codigo aceita letras, numeros, - e _.");

const optionalCodeSchema = z
  .string()
  .trim()
  .transform((value) => (value && value.length > 0 ? value : undefined))
  .pipe(codeSchema.optional())
  .optional();

const optionalOrdemSchema = z
  .number({ error: "Ordem deve ser numerica." })
  .int("Ordem deve ser inteira.")
  .min(0)
  .max(9999)
  .optional();

const nameSchema = z.string().trim().min(2).max(160);
const titleSchema = z.string().trim().min(2).max(200);
const longTextSchema = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null))
  .nullable();
const descriptionSchema = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null))
  .nullable();

const statusSchema = z
  .enum(LIBRARY_ITEM_STATUSES)
  .optional();
const recommendationTypeSchema = z
  .enum(LIBRARY_RECOMMENDATION_TYPES)
  .optional();
const tagsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[a-z0-9][a-z0-9-]*$/i, "Tag aceita letras, numeros e hifen."),
  )
  .max(20)
  .optional();

const parameterVariableSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_]+$/i, "Variavel aceita letras, numeros e underscore."),
  label: z.string().trim().min(1).max(120),
  exemplo: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null))
    .nullable(),
});

const parametersSchema = z.array(parameterVariableSchema).max(20).optional();

const commonFields = {
  status: statusSchema,
  tags: tagsSchema,
};

/** Entidades aceitas pela API/UI da Biblioteca Geral. */
export const libraryCatalogEntitySchema = z.enum(LIBRARY_CATALOG_ENTITIES);

export const libraryAxisInputSchema = z.object({
  ...commonFields,
  code: optionalCodeSchema,
  name: nameSchema,
  description: descriptionSchema,
  ordem: optionalOrdemSchema,
});

export const librarySectionInputSchema = z.object({
  ...commonFields,
  axisId: z.string().uuid({ message: "Eixo inválido." }),
  code: optionalCodeSchema,
  name: nameSchema,
  description: descriptionSchema,
  ordem: optionalOrdemSchema,
});

export const libraryRecommendationInputSchema = z.object({
  ...commonFields,
  code: optionalCodeSchema,
  title: titleSchema,
  description: descriptionSchema,
  tipo: recommendationTypeSchema,
  textoBaseFixo: longTextSchema,
  textoBaseParametrizavel: longTextSchema,
  variaveisParametro: parametersSchema,
  fundamentoTecnico: longTextSchema,
  escopoAplicacao: longTextSchema,
});

export type LibraryAxisInput = z.infer<typeof libraryAxisInputSchema>;
export type LibrarySectionInput = z.infer<typeof librarySectionInputSchema>;
export type LibraryRecommendationInput = z.infer<typeof libraryRecommendationInputSchema>;

export const libraryCatalogInputSchemaByEntity = {
  axes: libraryAxisInputSchema,
  sections: librarySectionInputSchema,
  recommendations: libraryRecommendationInputSchema,
} as const satisfies Record<LibraryCatalogEntity, z.ZodTypeAny>;

export type LibraryCatalogInputByEntity = {
  axes: LibraryAxisInput;
  sections: LibrarySectionInput;
  recommendations: LibraryRecommendationInput;
};
