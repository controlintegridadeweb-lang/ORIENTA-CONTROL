import { z } from "zod";

/**
 * Schemas Zod para o CRUD admin de formularios e criterios. Centraliza
 * validacoes usadas pelas rotas e pelos testes do service.
 *
 * Modelo canonico: prazo e arquivamento NAO pertencem ao formulario (prazo vive
 * no ciclo; arquivamento e estado de form_version). Por isso nao ha mais
 * `setDeadlineSchema`/`archiveFormSchema`.
 */

export const createFormSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome.").max(200),
});

export const renameFormSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome.").max(200),
});

/**
 * Criar criterio exige a SECAO — toda question pertence a uma secao (que
 * pertence a um eixo FAMI). `questions.section_id` é NOT NULL. A exigência de
 * evidência define o peso máximo (política FAMI v7): critério sem exigência
 * vale até 1,0; critério com exigência vale até 2,0 somente com comprovação
 * aprovada (sem aprovação = 0 no numerador; máximo permanece 2).
 */
export const createQuestionSchema = z.object({
  prompt: z.string().trim().min(1, "Informe o enunciado.").max(500),
  sectionId: z.string().uuid("Selecione uma secao valida."),
  requiresEvidence: z.boolean().default(false),
  /** Permite classificação administrativa “Não se aplica” na validação. */
  allowsNotApplicable: z.boolean().default(false),
});

export const updateQuestionSchema = z
  .object({
    prompt: z.string().trim().min(1).max(500).optional(),
    sectionId: z.string().uuid().optional(),
    requiresEvidence: z.boolean().optional(),
    allowsNotApplicable: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.prompt !== undefined ||
      v.sectionId !== undefined ||
      v.requiresEvidence !== undefined ||
      v.allowsNotApplicable !== undefined,
    { message: "Informe pelo menos um campo para atualizar." },
  );

export const reorderSchema = z.object({
  orderedQuestionIds: z.array(z.string().uuid()).min(1),
});
