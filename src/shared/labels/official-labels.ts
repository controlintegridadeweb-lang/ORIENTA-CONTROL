/**
 * Vocabulário visível da plataforma.
 *
 * A interface usa “pergunta” para a unidade respondida, “diagnóstico” para a
 * execução de um formulário por organização e período, e “organização” para
 * a instituição participante. Os nomes técnicos podem continuar diferentes
 * no código e no banco sem vazar para a experiência de uso.
 */

export const evidenceLabels = {
  adjustmentRequested: "Ajuste solicitado",
  adjustmentDescription: "A equipe solicitou ajuste nesta evidência.",
  respondentAdjustmentStatus: "Ajuste solicitado",
  respondentAdjustmentDescription: "Envie uma nova evidência conforme a orientação da validação.",
  navDescription: "Consulte as evidências enviadas e os ajustes solicitados pela equipe de validação.",
  kpiLabel: "Pendências de evidência",
  kpiHintPending: "Há ajustes ou comprovações aguardando sua ação.",
  kpiHintEmpty: "Nenhuma pendência de ajuste no período.",
  statusShort: "Ajuste",
  proofRequestShort: "Comprovação",
  respondCta: "Corrigir evidência",
  sectionTitle: "Ajustes solicitados",
  sectionDescription:
    "Evidências devolvidas e critérios com comprovação solicitada após a validação.",
  panelHint: "Ajuste solicitado — revise o envio conforme a orientação da validação.",
  answersOrgStatus: "Correções solicitadas",
};


export const diagnosisLabels = {
  singular: "Diagnóstico",
  plural: "Diagnósticos",
  new: "Novo diagnóstico",
  draftDescription: "O diagnóstico começa como rascunho e pode ser aberto depois de criado.",
  configHint: "Diagnóstico: execução de um formulário para uma organização em um período.",
};

/** UI: a tabela técnica `questions` é exibida como Pergunta. */
export const perguntaLabels = {
  singular: "Pergunta",
  plural: "Perguntas",
  originLabel: "Critério de origem",
  tableColumn: "Pergunta",
  filterPlaceholder: "Recomendação, pergunta, eixo ou organização…",
  evidenceRegisterHint:
    "Revise os dados e use Salvar resposta para registrar o atendimento desta pergunta.",
  linkedLabel: "Critério de origem",
  notApplicableInDiagnosis: "Não se aplica neste diagnóstico",
  notApplicableForOrganization: "Pergunta não aplicável a esta organização",
  applicabilityByOrganization: "Aplicabilidade por organização",
};

export const organizationLabels = {
  singular: "Organização",
  plural: "Organizações",
};

export const famiAnnualLabels = {
  title: "FAMI anual",
  description:
    "Resultado oficial consolidado do diagnóstico. É a pontuação divulgada anualmente pela Controladoria-Geral do Estado.",
  disclaimer:
    "O FAMI anual é o resultado oficial consolidado. O FAMI preliminar quadrimestral é apenas acompanhamento e não o substitui.",
  pending: "Não calculado",
  pendingHint: "Aguardando o fechamento anual.",
  percentageLabel: "Resultado oficial",
  levelLabel: "Nível FAMI",
  updatedLabel: "Consolidado em",
};

export const famiPreliminaryLabels = {
  title: "Acompanhamento",
  description:
    "Relatórios bimestrais do plano de integridade e compliance e FAMI preliminar quadrimestral. O FAMI preliminar não substitui o FAMI anual.",
  panoramaLabel: "FAMI preliminar",
  unofficial:
    "Tem histórico e exportação próprios e não entra no PDF do Resultado FAMI.",
  methodology:
    "Parte do Resultado FAMI oficial da data de corte. O percentual das ações não gera pontos; somente o critério efetivamente concluído e aceito recupera o gap integral. Ações canceladas e exceções aprovadas não geram recuperação.",
  methodologyV1:
    "Parte do Resultado FAMI oficial que já existia na data de corte e estima somente a recuperação dos critérios com recomendação, pela média do progresso das ações ativas. Ações canceladas e exceções aprovadas não geram recuperação.",
  trackingTitle: (year: number) => `Acompanhamento ${year}`,
  requirement:
    "Durante o quadrimestre o administrador pode calcular ou recalcular a prévia com os dados válidos até o instante da execução. Na data de corte o sistema consolida automaticamente um snapshot imutável. Alterações posteriores entram só no quadrimestre seguinte.",
  statusOpen: "Em andamento",
  statusCompleted: "Concluído",
  statusNotImplemented: "Não implementado",
  statusUpcoming: "Aguardando período",
  calculate: (quadrimester: 1 | 2 | 3) => `Calcular o ${quadrimester}º quadrimestre`,
  calculateAgain: (quadrimester: 1 | 2 | 3) => `Recalcular o ${quadrimester}º quadrimestre`,
  calculateRow: "Calcular",
  recalculateRow: "Recalcular",
  viewDetails: "Ver detalhes",
  hideDetails: "Ocultar detalhes",
  calculating: "Calculando…",
  calculated: (quadrimester: 1 | 2 | 3) => `${quadrimester}º quadrimestre registrado.`,
  recalculated: (quadrimester: 1 | 2 | 3) => `${quadrimester}º quadrimestre recalculado.`,
  loadError: "Não foi possível carregar o FAMI preliminar.",
  calculateError: "Não foi possível calcular o FAMI preliminar.",
  invalidResponse: "A resposta do servidor não pôde ser lida.",
  exportHistory: "Exportar histórico CSV",
  closedPeriodHint: "O quadrimestre já foi fechado e não pode ser alterado.",
  bimonthlyReportAvailable: "Relatório disponível",
  bimonthlyReportPending: "Relatório ainda não gerado",
  quadrimesterCalculated: (quadrimester: 1 | 2 | 3) =>
    `${quadrimester}º quadrimestre calculado`,
  generateBimester: "Gerar",
  generatingBimester: "Gerando…",
  exportMenu: "Exportar",
  exportPdf: "Exportar PDF",
  exportXlsx: "Exportar Excel",
  exportPdfHint:
    "Relatório bimestral de acompanhamento do plano de integridade e compliance.",
  exportXlsxHint: "Planilha do snapshot bimestral.",
  exportPreliminaryPdfHint: "FAMI preliminar quadrimestral em PDF.",
  exportPreliminaryXlsxHint: "Planilha do FAMI preliminar quadrimestral.",
  officialFami: "FAMI oficial",
  previousPreliminary: "FAMI preliminar anterior",
  currentPreliminary: "FAMI preliminar atual",
  recoveredPoints: "Pontos recuperados",
  criteriaNowScoring: "Critérios que passaram a pontuar",
};

/** Títulos do documento PDF (capa). O filtro do histórico usa `reportCatalogLabels`. */
export const reportDocumentTitles = {
  annual: (year: number) => `Relatório anual ${year}`,
  bimonthly:
    "Relatório bimestral de acompanhamento do plano de integridade e compliance",
} as const;

/** Tipos visíveis no histórico de Relatórios. */
export const reportCatalogLabels = {
  annual: "Relatório anual",
  bimonthly: "Relatório bimestral",
  annualHint: "PDF oficial emitido no encerramento do diagnóstico, com o Resultado FAMI consolidado.",
  bimonthlyHint:
    "Fotografia do plano de integridade e compliance no bimestre. Não inclui Resultado FAMI.",
  historyTitle: "Histórico de relatórios",
  historyDescription:
    "Relatórios anuais do diagnóstico e relatórios bimestrais já gerados do plano de integridade e compliance.",
  typeFilter: "Tipo",
  allTypes: "Todos",
  emptyTitle: "Nenhum relatório disponível",
  emptyDescription:
    "O relatório anual fica disponível após o encerramento do diagnóstico. Os relatórios bimestrais aparecem depois de gerados no acompanhamento.",
  adminEmptyDescription:
    "Não há PDF anual nem relatório bimestral para o filtro atual. A primeira emissão anual ocorre no encerramento do diagnóstico.",
};
