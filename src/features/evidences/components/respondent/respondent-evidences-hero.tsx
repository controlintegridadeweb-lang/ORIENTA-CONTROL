"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { IllustratedPageHero } from "@/shared/ui/components/illustrated-page-hero";
import { RefreshActionButton } from "@/shared/ui/components/refresh-action-button";
import { formSurface } from "@/shared/layout/form-surface";

const HERO_IMAGE = "/assets/respondent-evidences-hero.png";

type Props = {
  onRefresh: () => void;
  refreshing: boolean;
};

export function RespondentEvidencesHero({ onRefresh, refreshing }: Props) {
  return (
    <IllustratedPageHero
      theme="respondent"
      size="compact"
      ariaLabel="Evidências"
      overline="Acompanhamento de envios"
      title="Evidências"
      description="Acompanhe os arquivos enviados, o resultado da validação e os ajustes solicitados."
      image={HERO_IMAGE}
      priority
      actions={
        <>
          <RefreshActionButton onRefresh={onRefresh} refreshing={refreshing} />
          <Link href="/respondente/formularios" className={formSurface.primaryButtonSm}>
            Ir para diagnósticos
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </>
      }
    />
  );
}
