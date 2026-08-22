"use client";

import { Plus } from "lucide-react";
import { IllustratedPageHero } from "@/shared/ui/components/illustrated-page-hero";
import { ADMIN_BIBLIOTECA_HERO_IMAGE } from "@/shared/config/page-assets/admin-library-hero-image";
import { formSurface } from "@/shared/layout/form-surface";

type Props = { onNewSection: () => void };

export function AdminBibliotecaHero({ onNewSection }: Props) {
  return (
    <IllustratedPageHero
      theme="admin"
      size="compact"
      ariaLabel="Biblioteca Geral"
      overline="Catálogo institucional"
      title="Biblioteca Geral"
      description="Gerencie seções e conteúdos reutilizáveis dos eixos ESG da plataforma."
      image={ADMIN_BIBLIOTECA_HERO_IMAGE}
      priority
      actions={
        <button type="button" onClick={onNewSection} className={formSurface.primaryButtonSm}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Nova seção
        </button>
      }
    />
  );
}
