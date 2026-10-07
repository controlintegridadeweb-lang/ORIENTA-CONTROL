import { FileText, Mail, MessageCircle } from "lucide-react";
import { SUPPORT_HERO_IMAGE } from "@/shared/config/page-assets/support-hero-image";
import {
  SUPPORT_CARTILHA,
  SUPPORT_CHANNELS,
  SUPPORT_PAGE_DESCRIPTION,
  SUPPORT_PAGE_TITLE,
} from "@/shared/config/support-contacts";
import { PAGE_HERO_BLEED } from "@/shared/layout/page-hero-layout";
import { layout } from "@/shared/layout/design-system";
import { formSurface } from "@/shared/layout/form-surface";
import type { AppRole } from "@/shared/domain/app-role";
import { IllustratedPageHero } from "@/shared/ui/components/illustrated-page-hero";
import { PanelSection } from "@/shared/ui/components/panel-section";

const CONTACT_ITEMS = [
  { ...SUPPORT_CHANNELS.email, icon: Mail },
  { ...SUPPORT_CHANNELS.whatsapp, icon: MessageCircle },
] as const;

export function SupportPageContent({ role }: { role: AppRole }) {
  return (
    <div className={layout.pageStack}>
      <div className={PAGE_HERO_BLEED}>
        <IllustratedPageHero
          theme={role === "admin" ? "admin" : "respondent"}
          size="compact"
          ariaLabel={SUPPORT_PAGE_TITLE}
          overline="Ajuda e contato"
          title={SUPPORT_PAGE_TITLE}
          description={SUPPORT_PAGE_DESCRIPTION}
          image={SUPPORT_HERO_IMAGE}
          priority
        />
      </div>

      <div className={`mx-auto w-full max-w-4xl ${layout.panelStack}`}>
        <PanelSection title="Cartilha" variant="plain">
          <a
            href={SUPPORT_CARTILHA.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`${formSurface.subtlePanel} flex flex-col gap-3 transition hover:border-slate-300 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between`}
          >
            <span className="min-w-0">
              <p className={`flex items-center gap-2 ${formSurface.label}`}>
                <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {SUPPORT_CARTILHA.title}
              </p>
              <p className="mt-1.5 text-sm text-slate-600">{SUPPORT_CARTILHA.description}</p>
            </span>
            <span className={`${formSurface.secondaryButtonSm} shrink-0`}>Abrir PDF</span>
          </a>
        </PanelSection>

        <PanelSection title="Contato" variant="plain">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CONTACT_ITEMS.map((item) => {
              const Icon = item.icon;
              const body = (
                <>
                  <p className={`flex items-center gap-2 ${formSurface.label}`}>
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {item.label}
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-slate-900">{item.value}</p>
                </>
              );

              if (item.href) {
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    className={`${formSurface.subtlePanel} transition hover:border-slate-300 hover:bg-slate-50`}
                  >
                    {body}
                  </a>
                );
              }

              return (
                <div key={item.label} className={formSurface.subtlePanel}>
                  {body}
                </div>
              );
            })}
          </div>
        </PanelSection>
      </div>
    </div>
  );
}
