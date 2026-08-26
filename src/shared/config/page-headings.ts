/**
 * Titulos e subtitulos do cabeçalho principal por rota (prefixo mais longo vence).
 */
import { evidenceLabels } from "@/shared/labels/official-labels";
import { SUPPORT_PAGE_DESCRIPTION, SUPPORT_PAGE_TITLE } from "@/shared/config/support-contacts";

export type PageHeading = {
  title: string;
  description?: string;
  /** Evita repetir visualmente o título quando a própria página possui hero/cabeçalho contextual. */
  shellHeaderMode?: "full" | "controls-only";
};

type RouteHeading = { prefix: string } & PageHeading;

const ADMIN_HEADINGS: RouteHeading[] = [
  {
    prefix: "/admin/biblioteca",
    title: "Biblioteca Geral",
    description: "Gerencie seções e conteúdos reutilizáveis dos eixos ESG da plataforma.",
    shellHeaderMode: "controls-only",
  },
  {
    prefix: "/admin/formularios/novo",
    title: "Novo formulário",
    description: "Assistente de publicação: dados, perguntas, configurações, organizações e publicação.",
    shellHeaderMode: "controls-only",
  },
  {
    prefix: "/admin/formularios",
    title: "Formulários",
    description:
      "Lista de modelos, versões, perguntas e configurações. Os diagnósticos são gerenciados separadamente.",
    shellHeaderMode: "controls-only",
  },
  {
    prefix: "/admin/ciclos",
    title: "Situação dos órgãos",
    description: "Acompanhe os órgãos no formulário selecionado.",
    shellHeaderMode: "controls-only",
  },
  {
    prefix: "/admin/evidencias",
    title: "Evidências",
    description: evidenceLabels.navDescription,
    shellHeaderMode: "controls-only",
  },
  {
    prefix: "/admin/perfil",
    title: "Meu Perfil",
    description: "Atualize seus dados pessoais, consulte os acessos da conta e altere sua senha de acesso.",
    shellHeaderMode: "controls-only",
  },
  {
    prefix: "/admin/suporte",
    title: SUPPORT_PAGE_TITLE,
    description: SUPPORT_PAGE_DESCRIPTION,
    shellHeaderMode: "controls-only",
  },
  {
    prefix: "/admin/recomendacoes",
    title: "Recomendações",
    description:
      "Recomendações geradas após a conclusão da validação do diagnóstico. Consulte o motivo e acompanhe as ações vinculadas no Plano de ação.",
    shellHeaderMode: "controls-only",
  },
  {
    prefix: "/admin/plano-acao",
    title: "Plano de ação",
    description:
      "Execução operacional: ações, prazos, responsáveis, progresso e supervisão. Acompanhe a situação de cada ação na aba do plano vinculado.",
    shellHeaderMode: "controls-only",
  },
  {
    prefix: "/admin/maturidade",
    title: "Resultado FAMI",
    description: "Pontuação, nível de maturidade e evolução por formulário e organização.",
    shellHeaderMode: "controls-only",
  },
  {
    prefix: "/admin/organizacoes",
    title: "Organizações",
    description:
      "Cadastre e consulte as organizações avaliadas. Cada respondente pertence a exatamente uma organização; administradores têm visão global.",
    shellHeaderMode: "controls-only",
  },
  {
    prefix: "/admin/usuarios",
    title: "Usuários",
    description:
      "Crie e gerencie respondentes: edite nome, e-mail e organização vinculada, solicite a recuperação de senha ou remova contas. O perfil Respondente é fixo nesta área.",
    shellHeaderMode: "controls-only",
  },
  {
    prefix: "/admin/relatorios",
    title: "Relatórios",
    description: "Exportações e visões executivas para todas as organizações.",
    shellHeaderMode: "controls-only",
  },
  {
    prefix: "/admin",
    title: "Dashboard",
    description: "Visão geral do sistema de avaliação de maturidade em integridade.",
    shellHeaderMode: "controls-only",
  },
];

const RESPONDENT_HEADINGS: RouteHeading[] = [
  {
    prefix: "/respondente/ciclos",
    title: "Preencher diagnóstico",
    description:
      "Responda às perguntas e envie evidências do diagnóstico atribuído à sua organização.",
    shellHeaderMode: "controls-only",
  },
  {
    prefix: "/respondente/formularios",
    title: "Meus diagnósticos",
    description:
      "Responda, acompanhe validações e ajustes e consulte o histórico dos diagnósticos concluídos da sua organização.",
    shellHeaderMode: "controls-only",
  },
  {
    prefix: "/respondente/evidencias",
    title: "Evidências",
    description: evidenceLabels.navDescription,
    shellHeaderMode: "controls-only",
  },
  {
    prefix: "/respondente/portfolio-recomendacoes",
    title: "Recomendações",
    description:
      "Recomendações geradas após a conclusão da validação do diagnóstico. O Plano de ação é liberado após a consolidação do diagnóstico.",
    shellHeaderMode: "controls-only",
  },
  {
    prefix: "/respondente/plano-acao",
    title: "Plano de ação",
    description:
      "Ações com prazos, responsáveis e acompanhamento de progresso. Cada ação está vinculada à recomendação que a originou.",
    shellHeaderMode: "controls-only",
  },
  {
    prefix: "/respondente/relatorios",
    title: "Relatórios e Histórico",
    description:
      "PDFs oficiais emitidos para diagnósticos concluídos, com atalhos para Resultado FAMI, Recomendações e Plano de ação do mesmo diagnóstico.",
    shellHeaderMode: "controls-only",
  },
  {
    prefix: "/respondente/pontuacao-fami",
    title: "Resultado FAMI",
    description: "Pontuação e nível oficiais de maturidade do diagnóstico.",
    shellHeaderMode: "controls-only",
  },
  {
    prefix: "/respondente/perfil",
    title: "Meu Perfil",
    description: "Atualize seus dados pessoais, consulte os acessos da conta e altere sua senha de acesso.",
    shellHeaderMode: "controls-only",
  },
  {
    prefix: "/respondente/suporte",
    title: SUPPORT_PAGE_TITLE,
    description: SUPPORT_PAGE_DESCRIPTION,
    shellHeaderMode: "controls-only",
  },
  {
    prefix: "/respondente",
    title: "Área do respondente",
    description:
      "Diagnósticos em andamento · Recomendações · Plano de ação · Relatórios e histórico · Resultado FAMI.",
    shellHeaderMode: "controls-only",
  },
];

function pickHeading(pathname: string, rows: RouteHeading[]): PageHeading | null {
  const normalized = pathname.replace(/\/$/, "") || "/";
  const sorted = [...rows].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const row of sorted) {
    const p = row.prefix.replace(/\/$/, "") || "/";
    if (normalized === p || normalized.startsWith(`${p}/`)) {
      return {
        title: row.title,
        description: row.description,
        shellHeaderMode: row.shellHeaderMode,
      };
    }
  }
  return null;
}

export function getPageHeadingForPath(pathname: string): PageHeading {
  const url = new URL(pathname, "http://orienta.local");
  const path = url.pathname;
  if (
    path === "/respondente/portfolio-recomendacoes" &&
    url.searchParams.get("view") === "action-plan"
  ) {
    return {
      title: "Plano de ação",
      description:
        "Ações com prazos, responsáveis e acompanhamento de progresso, vinculadas às recomendações que as originaram.",
      shellHeaderMode: "controls-only",
    };
  }
  if (path.startsWith("/admin")) {
    return pickHeading(path, ADMIN_HEADINGS) ?? {
      title: "Administração",
      description: "Gestão da plataforma Orienta.",
    };
  }
  if (path.startsWith("/respondente")) {
    return pickHeading(path, RESPONDENT_HEADINGS) ?? {
      title: "Respondente",
      description: "Área de respostas e acompanhamento.",
    };
  }
  return { title: "Plataforma Orienta", description: undefined };
}
