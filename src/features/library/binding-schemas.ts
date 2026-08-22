import { z } from "zod";

const uuid = z.string().uuid();
const SHORT_TEXT_MAX = 500;

const longText = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null))
  .nullable();

const inlineRecommendationSchema = z
  .object({
    title: z.string().trim().min(1).max(SHORT_TEXT_MAX),
    description: longText,
    textoBaseFixo: longText,
    textoBaseParametrizavel: longText,
    tipo: z.enum(["nao_implementacao", "evidencia_insuficiente"]).nullable().optional(),
    fundamentoTecnico: longText,
    escopoAplicacao: longText,
  })
  .optional()
  .nullable();

const libraryBindingsSchema = z.object({
  defaultRecommendation: inlineRecommendationSchema,
  note: z.string().trim().max(2000).optional().nullable(),
});

/** O formulário operacional só aceita Sim, Não ou Não se aplica. */
const inlineMetricInputSchema = z.object({
  answerType: z.literal("yes_no"),
});

export const questionLibraryConfigurationInputSchema = z.object({
  sectionId: uuid,
  metric: inlineMetricInputSchema,
  bindings: libraryBindingsSchema,
  responseMapping: z.object({}).strict().default({}),
});

export type QuestionLibraryConfigurationInput = z.infer<typeof questionLibraryConfigurationInputSchema>;
