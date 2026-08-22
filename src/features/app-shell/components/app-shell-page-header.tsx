"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { getPageHeadingForPath } from "@/shared/config/page-headings";
import { typography } from "@/shared/layout/design-system";
import { SidebarMobileRail } from "./sidebar-mobile-rail";
import { NotificationBell } from "./notification-bell";

export function AppShellPageHeader({
  serverPathname,
  initialTitle,
  initialDescription,
}: {
  /** Pathname SSR (header `x-pathname`) para primeira pintura consistente */
  serverPathname: string;
  initialTitle: string;
  initialDescription?: string;
}) {
  const clientPathname = usePathname() ?? "";
  const pathname = clientPathname || serverPathname;
  const searchParams = useSearchParams();
  const routeWithQuery = searchParams.size > 0 ? `${pathname}?${searchParams.toString()}` : pathname;
  const fromRoute = getPageHeadingForPath(routeWithQuery);
  const title = fromRoute.title || initialTitle;
  const description = fromRoute.description ?? initialDescription;
  const controlsOnly = fromRoute.shellHeaderMode === "controls-only";

  return (
    <div className="relative sticky top-0 z-20 min-h-[var(--header-h)] min-w-0 border-b border-slate-200">
      {/* Blur em camada separada para não cortar o painel absoluto do sino. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/85"
      />
      <div className="relative flex min-h-[var(--header-h)] min-w-0">
        <SidebarMobileRail />
        <header className="flex min-w-0 flex-1 items-center px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className="min-w-0 flex-1">
            {/* Em controls-only o h1 da rota fica no PageHeader / hero da página. */}
            {controlsOnly ? null : (
              <>
                <h1 className={typography.pageTitle}>{title}</h1>
                {description ? (
                  <p className={`${typography.pageDescription} line-clamp-2`}>{description}</p>
                ) : null}
              </>
            )}
          </div>
          <NotificationBell />
        </header>
      </div>
    </div>
  );
}
