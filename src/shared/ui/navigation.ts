import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Building2,
  ClipboardList,
  FileBarChart,
  FileCheck,
  Gauge,
  LayoutDashboard,
  LifeBuoy,
  Lightbulb,
  ListChecks,
  RotateCw,
  User,
  Users,
} from "lucide-react";
import type { AppRole } from "@/shared/domain/app-role";
import {
  RESPONDENT_ACTION_PLAN_LIST_PATH,
  RESPONDENT_ACTION_PLAN_MODULE_LABEL,
  RESPONDENT_RECOMMENDATIONS_LIST_PATH,
  RESPONDENT_RECOMMENDATIONS_PORTFOLIO_LABEL,
} from "@/shared/navigation/respondent-portfolio-paths";

export type NavGroup = "principal" | "gestao" | "analise" | "sistema";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  group: NavGroup;
};

export const navGroupLabels: Record<NavGroup, string> = {
  principal: "",
  gestao: "Gestão",
  analise: "Análise",
  sistema: "Sistema",
};

export const roleLabels: Record<AppRole, string> = {
  admin: "Administrador",
  respondent: "Respondente",
};

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, group: "principal" },
  { href: "/admin/biblioteca", label: "Biblioteca Geral", icon: BookOpen, group: "gestao" },
  { href: "/admin/formularios", label: "Formulários", icon: ClipboardList, group: "gestao" },
  { href: "/admin/ciclos", label: "Situação dos órgãos", icon: RotateCw, group: "gestao" },
  {
    href: "/admin/evidencias",
    label: "Evidências",
    icon: FileCheck,
    group: "gestao",
  },
  { href: "/admin/maturidade", label: "Resultado FAMI", icon: Gauge, group: "analise" },
  { href: "/admin/recomendacoes", label: "Recomendações", icon: Lightbulb, group: "analise" },
  { href: "/admin/plano-acao", label: "Plano de integridade e compliance", icon: ListChecks, group: "analise" },
  { href: "/admin/relatorios", label: "Relatórios", icon: FileBarChart, group: "analise" },
  { href: "/admin/organizacoes", label: "Organizações", icon: Building2, group: "sistema" },
  { href: "/admin/usuarios", label: "Usuários", icon: Users, group: "sistema" },
  { href: "/admin/perfil", label: "Meu Perfil", icon: User, group: "sistema" },
  { href: "/admin/suporte", label: "Suporte", icon: LifeBuoy, group: "sistema" },
];

export const navigationByRole: Record<AppRole, NavItem[]> = {
  admin: ADMIN_NAV,
  respondent: [
    { href: "/respondente", label: "Dashboard", icon: LayoutDashboard, group: "principal" },
    { href: "/respondente/formularios", label: "Meus diagnósticos", icon: ClipboardList, group: "principal" },
    {
      href: "/respondente/evidencias?view=all",
      label: "Evidências",
      icon: FileCheck,
      group: "principal",
    },
    { href: "/respondente/pontuacao-fami", label: "Resultado FAMI", icon: Gauge, group: "principal" },
    {
      href: RESPONDENT_RECOMMENDATIONS_LIST_PATH,
      label: RESPONDENT_RECOMMENDATIONS_PORTFOLIO_LABEL,
      icon: Lightbulb,
      group: "principal",
    },
    {
      href: RESPONDENT_ACTION_PLAN_LIST_PATH,
      label: RESPONDENT_ACTION_PLAN_MODULE_LABEL,
      icon: ListChecks,
      group: "principal",
    },
    { href: "/respondente/relatorios", label: "Relatórios e Histórico", icon: FileBarChart, group: "principal" },
    { href: "/respondente/perfil", label: "Meu Perfil", icon: User, group: "sistema" },
    { href: "/respondente/suporte", label: "Suporte", icon: LifeBuoy, group: "sistema" },
  ],
};
