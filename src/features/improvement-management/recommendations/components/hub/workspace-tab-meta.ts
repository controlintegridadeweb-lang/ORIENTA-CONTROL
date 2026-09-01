export type WorkspaceTabKey = "overview" | "actions" | "monitoring";

export type WorkspaceTabMeta = {
  key: WorkspaceTabKey;
  label: string;
  tagline: string;
  description: string;
};

export const WORKSPACE_TABS: WorkspaceTabMeta[] = [
  {
    key: "overview",
    label: "Visão geral",
    tagline: "Por que existe?",
    description:
      "Contexto, critério de origem, texto oficial da recomendação e próximo passo.",
  },
  {
    key: "actions",
    label: "Plano de integridade e compliance",
    tagline: "Como vamos melhorar?",
    description: "Ações executáveis com responsável, início, final, progresso e comprovações.",
  },
  {
    key: "monitoring",
    label: "Monitoramento",
    tagline: "Estamos executando?",
    description: "Supervisão, pendências e decisões da ação em execução.",
  },
];

export function workspaceTabFromPathname(pathname: string): WorkspaceTabKey {
  if (pathname.endsWith("/monitoramento")) return "monitoring";
  if (pathname.endsWith("/acoes")) return "actions";
  return "overview";
}

export function workspaceTabMeta(pathname: string): WorkspaceTabMeta {
  const key = workspaceTabFromPathname(pathname);
  return WORKSPACE_TABS.find((t) => t.key === key) ?? WORKSPACE_TABS[0];
}

export function workspaceTabsForBasePath(
  basePath: string,
  order: WorkspaceTabKey[],
  options?: { actionsHrefSegment?: string; actionsLabel?: string },
): { href: string; label: string; tagline: string }[] {
  const actionsSegment = options?.actionsHrefSegment ?? "acoes";
  const actionsLabel = options?.actionsLabel ?? "Plano de integridade e compliance";
  return order.map((key) => {
    const meta = WORKSPACE_TABS.find((t) => t.key === key)!;
    const segment =
      key === "overview" ? "visao-geral" : key === "actions" ? actionsSegment : "monitoramento";
    return {
      href: `${basePath}/${segment}`,
      label: key === "actions" ? actionsLabel : meta.label,
      tagline: meta.tagline,
    };
  });
}
