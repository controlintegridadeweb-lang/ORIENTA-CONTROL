import { IllustratedPageHero } from "@/shared/ui/components/illustrated-page-hero";

const HERO_IMAGE = "/assets/respondent-dashboard-hero.png";

type Props = { year: number };

export function RespondentDashboardHero({ year }: Props) {
  return (
    <IllustratedPageHero
      theme="respondent"
      size="tall"
      ariaLabel="Visão geral do dashboard"
      overline="Painel de acompanhamento"
      title="Seu dashboard"
      description={`Acompanhe as prioridades, os ajustes solicitados e o progresso das respostas em ${year}.`}
      image={HERO_IMAGE}
      priority
    />
  );
}
