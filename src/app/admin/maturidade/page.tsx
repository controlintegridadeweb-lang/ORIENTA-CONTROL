import { getCurrentUser } from "@/infrastructure/auth/current-user";
import { FamiMaturityShell } from "@/features/fami/components/admin/fami-maturity-shell";
import { firstSearchParam } from "@/features/admin/search-params";
import { layout } from "@/shared/layout/design-system";
import type { AdminFamiTab } from "@/shared/navigation/fami-paths";

const ADMIN_FAMI_TABS = new Set<AdminFamiTab>(["resumo", "eixos", "secoes", "evolucao"]);

function parseYear(value: string | undefined): number | null {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2200 ? year : null;
}

export default async function AdminMaturidadePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const orgFromUrl = firstSearchParam(sp, "organizationId") ?? "";
  const formFromUrl = firstSearchParam(sp, "formId") ?? "";
  const cycleFromUrl = firstSearchParam(sp, "cycleId") ?? "";
  const profileOrg = user?.organizationId ?? "";
  const rawTab = firstSearchParam(sp, "tab") as AdminFamiTab | undefined;

  const defaultOrganizationId = orgFromUrl || (profileOrg ? profileOrg : null);
  const defaultFormId = formFromUrl || null;

  return (
    <div className={layout.pageStack}>
      <FamiMaturityShell
        mode="admin"
        defaultOrganizationId={defaultOrganizationId}
        defaultFormId={defaultFormId}
        defaultCycleId={cycleFromUrl || null}
        defaultSnapshotYear={parseYear(firstSearchParam(sp, "year"))}
        defaultTab={rawTab && ADMIN_FAMI_TABS.has(rawTab) ? rawTab : "resumo"}
      />
    </div>
  );
}
