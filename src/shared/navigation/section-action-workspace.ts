export const SECTION_ACTION_WORKSPACE_TABS = [
  "visao-geral",
  "problemas-solucoes",
  "acoes",
  "monitoramento",
] as const;

export type SectionActionWorkspaceTab = (typeof SECTION_ACTION_WORKSPACE_TABS)[number];

export const SECTION_ACTION_WORKSPACE_TAB_PATTERN = SECTION_ACTION_WORKSPACE_TABS.join("|");
