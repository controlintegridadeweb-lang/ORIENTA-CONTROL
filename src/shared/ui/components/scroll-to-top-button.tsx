"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { usePathname } from "next/navigation";
import { isFormFillRoute } from "@/shared/layout/form-fill-route";

/** Distância de scroll antes de exibir o botão. */
const SHOW_AFTER_PX = 280;

/**
 * Botão flutuante “Voltar ao topo” para páginas longas.
 * Fixo no canto inferior direito; aparece após rolagem.
 */
export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname() ?? "";
  const formFill = isFormFillRoute(pathname);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const scrollToTop = useCallback(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }, []);

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Voltar ao topo"
      title="Voltar ao topo"
      className={[
        "fixed z-40 flex h-11 w-11 items-center justify-center rounded-full",
        "border border-slate-200/90 bg-white/95 text-slate-600 shadow-card",
        "backdrop-blur-sm transition-all duration-300 ease-out",
        "hover:border-slate-300 hover:bg-white hover:text-brand-700 hover:shadow-card-hover",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        formFill ? "bottom-32 right-4 sm:bottom-36 sm:right-6" : "bottom-16 right-4 sm:bottom-20 sm:right-6",
        visible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0",
      ].join(" ")}
    >
      <ArrowUp className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
    </button>
  );
}
