import { NextResponse } from "next/server";
import { DomainNotFoundError } from "@/infrastructure/api/domain-errors";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { getAutomationJobStatus } from "@/application/automation/job-status-service";

export const GET = withRoute<{ jobId: string }>(
  { roles: ["admin"], route: "/api/admin/automation/jobs/[jobId]", logMessage: "Failed to load automation job" },
  async ({ params }) => {
    const jobId = requireUuid(params.jobId, "jobId");
    const job = await getAutomationJobStatus(jobId);
    if (!job) throw new DomainNotFoundError("Processamento não encontrado.");
    return NextResponse.json(job);
  },
);
