"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { withRespondentReturnPath } from "@/shared/navigation/respondent-navigation-context";
import { withAdminReturnPath } from "@/shared/navigation/admin-navigation-context";

export type RecommendationDetailTabDef = {
  href: string;
  label: string;
  tagline?: string;
};

function tabPathname(href: string): string {
  try {
    return new URL(href, "http://orienta.local").pathname;
  } catch {
    return href.split("?")[0] ?? href;
  }
}

function tabLinkClass(active: boolean): string {
  return `inline-flex min-h-12 items-center rounded-xl px-5 py-2.5 text-base font-semibold transition ${
    active
      ? "bg-brand text-white shadow-sm"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;
}

export function RecommendationDetailTabs({
  tabs,
  "aria-label": ariaLabel,
}: {
  tabs: RecommendationDetailTabDef[];
  "aria-label": string;
}) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const withReturnPath = pathname.startsWith("/admin/")
    ? withAdminReturnPath
    : withRespondentReturnPath;
  return (
    <nav
      className="rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm"
      aria-label={ariaLabel}
    >
      <ol className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => {
          const tabPath = tabPathname(tab.href);
          const active =
            pathname === tabPath ||
            (tabPath.length > 1 && pathname.startsWith(`${tabPath}/`));

          return (
            <li key={tab.href}>
              <Link
                href={withReturnPath(tab.href, returnTo)}
                className={tabLinkClass(active)}
                aria-current={active ? "page" : undefined}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
