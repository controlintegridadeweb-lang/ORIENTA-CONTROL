import { getCurrentUser } from "@/infrastructure/auth/current-user";
import { RespondentFamiShell } from "@/features/fami/components/respondent/respondent-fami-shell";
import { layout } from "@/shared/layout/design-system";
import { firstSearchParam } from "@/features/admin/search-params";
import type { RespondentFamiTab } from "@/shared/navigation/fami-paths";

const RESPONDENT_TABS = new Set<RespondentFamiTab>([
  "panorama",
  "eixos",
  "secoes",
  "evolucao",
]);

function parseYear(value: string | undefined): number | null {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2200 ? year : null;
}

export default async function RespondentePontuacaoFamiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const defaultCycleId = firstSearchParam(params, "cycleId") ?? null;
  const rawTab = firstSearchParam(params, "tab") as RespondentFamiTab | undefined;
  return (
    <div className={layout.pageStack}>
      <RespondentFamiShell
        defaultOrganizationId={user?.organizationId ?? null}
        defaultCycleId={defaultCycleId}
        defaultSnapshotYear={parseYear(firstSearchParam(params, "year"))}
        defaultTab={rawTab && RESPONDENT_TABS.has(rawTab) ? rawTab : "panorama"}
      />
    </div>
  );
}
