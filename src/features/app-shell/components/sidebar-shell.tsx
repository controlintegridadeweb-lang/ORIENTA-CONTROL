"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { ScrollToTopButton } from "@/shared/ui/components/scroll-to-top-button";
import { trapTabFocus, visibleFocusableElements } from "@/shared/accessibility/focus-trap";

const STORAGE_KEY = "orienta.sidebar.collapsed";
const SIDEBAR_ID = "orienta-sidebar";
type SidebarContextValue = {
  mobileOpen: boolean;
  collapsed: boolean;
  menuIconOpen: boolean;
  menuAriaLabel: string;
  toggleMenu: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleCollapsed: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    return {
      mobileOpen: false,
      collapsed: false,
      menuIconOpen: false,
      menuAriaLabel: "Abrir menu",
      toggleMenu: () => {},
      openDrawer: () => {},
      closeDrawer: () => {},
      toggleCollapsed: () => {},
    };
  }
  return ctx;
}

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

/**
 * Layout autenticado com sidebar recolhível no desktop e drawer modal no mobile.
 * O drawer usa `inert`, contenção de foco e restauração do acionador para que
 * links fora da tela nunca entrem na ordem de tabulação.
 */
export function SidebarShell({
  branding,
  user,
  nav,
  footer,
  children,
}: {
  branding: ReactNode;
  user: ReactNode;
  nav: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const isDesktop = useIsDesktop();
  const sidebarRef = useRef<HTMLElement | null>(null);
  const drawerTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- Hidrata uma preferência exclusiva do navegador após a montagem. */
    try {
      if (localStorage.getItem(STORAGE_KEY) === "true") setCollapsed(true);
    } catch {
      // Preferência opcional; a navegação continua funcional sem localStorage.
    }
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "true" : "false");
    } catch {
      // Falha de persistência não altera o estado da sessão atual.
    }
  }, [collapsed, mounted]);

  useEffect(() => {
    // Mudança de rota encerra o estado modal pertencente à rota anterior.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Sincronização intencional com a navegação do App Router.
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (mobileOpen && !isDesktop) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDesktop, mobileOpen]);

  const restoreDrawerTrigger = useCallback(() => {
    const trigger = drawerTriggerRef.current;
    drawerTriggerRef.current = null;
    window.requestAnimationFrame(() => trigger?.focus());
  }, []);

  const openDrawer = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      drawerTriggerRef.current = document.activeElement;
    }
    setMobileOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setMobileOpen(false);
    restoreDrawerTrigger();
  }, [restoreDrawerTrigger]);

  const toggleCollapsed = useCallback(() => setCollapsed((value) => !value), []);

  const toggleMenu = useCallback(() => {
    if (isDesktop) {
      setCollapsed((value) => !value);
      return;
    }
    if (mobileOpen) closeDrawer();
    else openDrawer();
  }, [closeDrawer, isDesktop, mobileOpen, openDrawer]);

  useEffect(() => {
    if (!mobileOpen || isDesktop) return;
    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const focusables = visibleFocusableElements(sidebar);
    (focusables[0] ?? sidebar).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }
      trapTabFocus(event, sidebar);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeDrawer, isDesktop, mobileOpen]);

  const menuIconOpen = !isDesktop && mobileOpen;
  const menuAriaLabel = isDesktop
    ? collapsed
      ? "Expandir menu lateral"
      : "Recolher menu lateral"
    : mobileOpen
      ? "Fechar menu"
      : "Abrir menu";

  const contextValue: SidebarContextValue = {
    mobileOpen,
    collapsed,
    menuIconOpen,
    menuAriaLabel,
    toggleMenu,
    openDrawer,
    closeDrawer,
    toggleCollapsed,
  };

  const desktopWidth = collapsed ? "md:w-19" : "md:w-80";
  const drawerIsHidden = !isDesktop && !mobileOpen;
  const contentIsBlocked = !isDesktop && mobileOpen;

  return (
    <SidebarContext.Provider value={contextValue}>
      <div className="flex min-h-screen bg-slate-50 text-slate-900">
        <aside
          ref={sidebarRef}
          id={SIDEBAR_ID}
          data-collapsed={collapsed ? "true" : "false"}
          className={[
            "fixed inset-y-0 left-0 z-40 flex w-[min(20rem,calc(100vw-2rem))] shrink-0 flex-col",
            "bg-brand-800 text-white shadow-xl ring-1 ring-black/10",
            "transition-[transform,width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
            "md:relative md:z-auto md:translate-x-0 md:shadow-none",
            desktopWidth,
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          ].join(" ")}
          aria-label="Menu lateral de navegação"
          aria-hidden={drawerIsHidden || undefined}
          aria-modal={!isDesktop && mobileOpen ? true : undefined}
          role={!isDesktop && mobileOpen ? "dialog" : undefined}
          tabIndex={!isDesktop && mobileOpen ? -1 : undefined}
          inert={drawerIsHidden ? true : undefined}
        >
          {branding}
          {user}
          {nav}
          {footer}
        </aside>

        <button
          type="button"
          aria-label="Fechar menu"
          aria-hidden={!mobileOpen}
          tabIndex={-1}
          onClick={closeDrawer}
          className={[
            "fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-xs",
            "transition-opacity duration-300 ease-out md:hidden",
            mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
          ].join(" ")}
        />

        <div
          className="flex min-w-0 flex-1 flex-col"
          aria-hidden={contentIsBlocked || undefined}
          inert={contentIsBlocked ? true : undefined}
        >
          {children}
          <ScrollToTopButton />
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
