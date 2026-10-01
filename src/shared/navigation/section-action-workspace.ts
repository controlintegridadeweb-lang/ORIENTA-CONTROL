export const SECTION_ACTION_WORKSPACE_TABS = [
  "visao-geral",
  "acoes",
  "monitoramento",
  "problemas-solucoes",
] as const;

export type SectionActionWorkspaceTab = (typeof SECTION_ACTION_WORKSPACE_TABS)[number];

export const SECTION_ACTION_WORKSPACE_TAB_PATTERN = SECTION_ACTION_WORKSPACE_TABS.join("|");
