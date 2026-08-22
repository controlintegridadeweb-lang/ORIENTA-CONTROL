/**
 * O formulário operacional do ORIENTA usa respostas binárias. Esta estrutura
 * existe apenas para manter o contrato JSON do vínculo estável no banco.
 */
export type ResponseMapping = Record<string, never>;

/** Texto padrão de recomendação associado à pergunta. */
export type InlineLibraryRecommendation = {
  title: string;
  description?: string | null;
  textoBaseFixo?: string | null;
  textoBaseParametrizavel?: string | null;
  tipo?: "nao_implementacao" | "ausencia_evidencia" | "evidencia_insuficiente" | null;
  fundamentoTecnico?: string | null;
  escopoAplicacao?: string | null;
};

export type LibraryBindings = {
  defaultRecommendation?: InlineLibraryRecommendation | null;
  note?: string | null;
};

/** Configuração fixa do único tipo de resposta aceito pelo fluxo operacional. */
export type InlineMetric = {
  name: string;
  description?: string | null;
  answerType: "yes_no";
  interpretation: "qualitative";
};


/**
 * Configuração de biblioteca exibida para uma pergunta do rascunho.
 * `sectionId` vem exclusivamente de `questions.section_id`; os demais campos
 * são editoriais e persistem em `question_library_binding`.
 */
export type QuestionLibraryConfiguration = {
  questionId: string;
  sectionId: string;
  metric: InlineMetric | null;
  bindings: LibraryBindings;
  responseMapping: ResponseMapping;
  coverageScore: number;
  updatedBy: string | null;
  updatedAt: string | null;
};
