import type { ReactNode } from "react";
import { headers } from "next/headers";
import { getCurrentUserDisplayName, type CurrentUser } from "@/infrastructure/auth/current-user";
import {
  navGroupLabels,
  navigationByRole,
  roleLabels,
  type NavGroup,
  type NavItem,
} from "@/shared/ui/navigation";
import { layout, sidebar } from "@/shared/layout/design-system";
import { InstitutionalFooter } from "@/shared/ui/components/institutional-footer";
import { SidebarNavLink } from "./sidebar-nav";
import { AppShellPageHeader } from "./app-shell-page-header";
import { LogoutButton } from "./logout-button";
import { PageShell } from "./page-shell";
import { SidebarBrandHeader } from "./sidebar-brand-header";
import { SidebarShell } from "./sidebar-shell";

const GROUP_ORDER: NavGroup[] = ["principal", "gestao", "analise", "sistema"];

function groupItems(items: NavItem[]): Record<NavGroup, NavItem[]> {
  const base: Record<NavGroup, NavItem[]> = {
    principal: [],
    gestao: [],
    analise: [],
    sistema: [],
  };
  for (const item of items) {
    base[item.group].push(item);
  }
  return base;
}

export async function AppShell({
  user,
  title,
  description,
  children,
}: {
  user: CurrentUser;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const headersList = await headers();
  const serverPathname = headersList.get("x-pathname") ?? "";

  const items = navigationByRole[user.role];
  const grouped = groupItems(items);
  const displayName = getCurrentUserDisplayName(user);
  const roleLabel = roleLabels[user.role];

  const branding = <SidebarBrandHeader />;

  const userCard = (
    <div className="sb-user-card flex items-center gap-3 border-b border-white/15 px-5 py-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-base font-medium text-white ring-1 ring-white/30">
        {displayName.charAt(0)}
      </div>
      <div className="sb-label min-w-0 leading-snug">
        <p className="truncate text-sm font-semibold text-white">{displayName}</p>
        <p className="mt-0.5 text-sm text-white/85">{roleLabel}</p>
        {user.organizationName ? (
          <p className="truncate text-sm text-white/75">{user.organizationName}</p>
        ) : null}
      </div>
    </div>
  );

  const nav = (
    <nav
      aria-label="Navegação principal"
      className="scrollbar-thin flex-1 space-y-7 overflow-y-auto px-4 py-6"
    >
      {GROUP_ORDER.map((group) => {
        const groupItemsList = grouped[group];
        if (groupItemsList.length === 0) return null;
        const label = navGroupLabels[group];
        return (
          <div key={group} className="space-y-2">
            {label ? (
              <p className={sidebar.groupLabel}>{label}</p>
            ) : null}
            <div className="space-y-1.5">
              {groupItemsList.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarNavLink key={item.href} href={item.href} label={item.label}>
                    <Icon className="size-4.5 shrink-0 opacity-95" aria-hidden />
                  </SidebarNavLink>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="sb-footer border-t border-white/15 px-4 py-5">
      <LogoutButton className="flex w-full items-center justify-start gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-white/92 transition hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white disabled:opacity-60" />
    </div>
  );

  return (
    <SidebarShell branding={branding} user={userCard} nav={nav} footer={footer}>
      <AppShellPageHeader
        serverPathname={serverPathname}
        initialTitle={title}
        initialDescription={description}
      />
      <main className={layout.appMain}>
        <PageShell>{children}</PageShell>
      </main>
      <InstitutionalFooter />
    </SidebarShell>
  );
}
