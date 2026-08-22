import { NextResponse } from "next/server";
import { DomainConflictError, DomainNotFoundError } from "@/infrastructure/api/domain-errors";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { createReportBundleDownload } from "@/application/automation/report-bundle-service";

export const GET = withRoute<{ jobId: string }>(
  { roles: ["admin"], route: "/api/admin/automation/jobs/[jobId]/download", logMessage: "Failed to create automation job download" },
  async ({ params }) => {
    const jobId = requireUuid(params.jobId, "jobId");
    try {
      const download = await createReportBundleDownload(jobId);
      if (!download) throw new DomainNotFoundError("Pacote de relatórios não encontrado.");
      return NextResponse.json(download);
    } catch (error) {
      if (error instanceof DomainNotFoundError) throw error;
      if (error instanceof Error && error.message.includes("ainda não está disponível")) {
        throw new DomainConflictError(error.message);
      }
      throw error;
    }
  },
);
