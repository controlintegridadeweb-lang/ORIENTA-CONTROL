import { ReportsShell } from "@/features/reports/components/admin/reports-shell";
import { layout } from "@/shared/layout/design-system";
import { firstSearchParam } from "@/features/admin/search-params";

export default async function AdminRelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialOrganizationId = firstSearchParam(params, "organizationId") ?? null;
  const initialCycleId = firstSearchParam(params, "cycleId") ?? null;
  const rawOffset = Number(firstSearchParam(params, "offset") ?? "0");
  const initialHistoryOffset = Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  return (
    <div className={layout.pageStack}>
      <ReportsShell
        initialOrganizationId={initialOrganizationId}
        initialCycleId={initialCycleId}
        initialHistoryOffset={initialHistoryOffset}
      />
    </div>
  );
}
