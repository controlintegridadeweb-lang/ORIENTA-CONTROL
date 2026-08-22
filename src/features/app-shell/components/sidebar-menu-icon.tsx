"use client";

/**
 * Ícone hambúrguer com animação para estado aberto (linhas → X).
 */
export function SidebarMenuIcon({ open }: { open: boolean }) {
  return (
    <span className="relative inline-flex h-5 w-5 items-center justify-center" aria-hidden>
      <span
        className={[
          "absolute block h-0.5 w-4.5 rounded-full bg-current",
          "origin-center transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          open ? "translate-y-0 rotate-45" : "-translate-y-[6px]",
        ].join(" ")}
      />
      <span
        className={[
          "absolute block h-0.5 w-4.5 rounded-full bg-current",
          "transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
          open ? "scale-x-0 opacity-0" : "scale-x-100 opacity-100",
        ].join(" ")}
      />
      <span
        className={[
          "absolute block h-0.5 w-4.5 rounded-full bg-current",
          "origin-center transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          open ? "translate-y-0 -rotate-45" : "translate-y-[6px]",
        ].join(" ")}
      />
    </span>
  );
}
