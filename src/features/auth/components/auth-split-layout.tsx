import Image from "next/image";
import type { ReactNode } from "react";
import { AuthFooter } from "@/features/auth/components/auth-footer";
import { typography } from "@/shared/layout/design-system";

/**
 * Layout institucional em duas colunas: marca em faixa branca e formulário sobre verde Orienta.
 */
export function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-brand-700">
      <section className="flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch">
        {/* Identidade: faixa branca — marca centrada, hierarquia em verde institucional */}
        <div className="flex flex-col justify-center border-b border-slate-200 bg-white px-6 py-10 sm:px-10 lg:w-1/2 lg:border-b-0 lg:border-r lg:border-slate-200 lg:py-14 lg:pl-12 lg:pr-12 xl:pl-16 xl:pr-16">
          <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 text-center sm:gap-3.5 lg:gap-4 lg:-translate-y-2 xl:-translate-y-3">
            <Image
              src="/assets/logo-orienta.png"
              alt="Plataforma Orienta"
              width={800}
              height={300}
              quality={95}
              sizes="(min-width: 1024px) min(500px, 48vw), min(92vw, 440px)"
              priority
              className="mx-auto h-auto w-auto max-h-41 max-w-full object-contain object-center sm:max-h-43 sm:max-w-120 lg:max-h-45 lg:max-w-132"
            />
            <h2 className="max-w-md text-balance text-2xl font-semibold leading-snug tracking-tight text-slate-950 md:text-3xl lg:text-4xl">
              Diagnóstico e gestão da maturidade organizacional
            </h2>
            <p className={`max-w-104 text-pretty ${typography.pageDescription}`}>
              Formulários, evidências, recomendações e planos de ação integrados ao trabalho da
              Controladoria-Geral do Estado do Rio Grande do Norte.
            </p>
          </div>
        </div>

        {/* Formulário — verde institucional (alinhado ao eixo vertical da coluna esquerda) */}
        <div className="flex flex-1 flex-col justify-center px-5 py-12 sm:px-10 lg:px-12 lg:py-16 xl:px-16">
          <div className="mx-auto w-full max-w-xl lg:-translate-y-2 xl:-translate-y-3">{children}</div>
        </div>
      </section>

      <AuthFooter />
    </main>
  );
}
