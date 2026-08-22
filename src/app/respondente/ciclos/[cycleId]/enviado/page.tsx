import { notFound, redirect } from "next/navigation";
import { firstSearchParam } from "@/features/admin/search-params";
import { getCycleDetail } from "@/features/cycles/cycle-queries";
import { RespondentSubmissionConfirmation } from "@/features/workbench/components/respondent-form/respondent-submission-confirmation";
import { getCurrentUser } from "@/infrastructure/auth/current-user";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { resolveCycleOperationalScope } from "@/infrastructure/supabase/cycle-operational-scope";
import {
  respondentCyclePath,
  respondentCycleReturnPathOrFallback,
} from "@/shared/navigation/respondent-navigation-context";
import { parseUuidParam } from "@/shared/validation/uuid";

type Props = {
  params: Promise<{ cycleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RespondenteCicloEnviadoPage({
  params,
  searchParams,
}: Props) {
  const user = await getCurrentUser();
  const { cycleId: rawId } = await params;
  const cycleId = parseUuidParam(rawId);
  if (!cycleId || !user?.organizationId) notFound();

  const supabase = createSupabaseServiceRoleClient();
  const [cycle, scope] = await Promise.all([
    getCycleDetail(supabase, cycleId),
    resolveCycleOperationalScope(supabase, cycleId),
  ]);
  if (!cycle || cycle.organizationId !== user.organizationId || cycle.state === "draft") {
    notFound();
  }

  const sp = await searchParams;
  const returnTo = respondentCycleReturnPathOrFallback(firstSearchParam(sp, "returnTo"));
  if (cycle.state === "in_response") {
    redirect(respondentCyclePath(cycle.id, returnTo));
  }

  const submittedAt = scope?.cycle.submittedAt;
  if (!submittedAt) notFound();

  const submissionKind =
    firstSearchParam(sp, "submission") === "corrections" ? "corrections" : "diagnostic";

  return (
    <RespondentSubmissionConfirmation
      cycleId={cycle.id}
      formName={cycle.formName}
      periodLabel={cycle.periodLabel}
      submittedAt={submittedAt}
      submittedLateAt={cycle.submittedLateAt}
      submissionDelaySeconds={cycle.submissionDelaySeconds}
      state={cycle.state}
      diagnosesHref={returnTo}
      submissionKind={submissionKind}
    />
  );
}
