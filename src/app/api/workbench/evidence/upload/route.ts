import { withRoute, type WithRouteOptions } from "@/infrastructure/api/with-route";
import { initializeEvidenceUpload } from "@/application/workbench-evidence-upload/initialize-evidence-upload";
import { verifyEvidenceUpload } from "@/application/workbench-evidence-upload/verify-evidence-upload";

export const runtime = "nodejs";
export const maxDuration = 120;

const routeOptions: Pick<WithRouteOptions, "roles" | "route" | "mutationRateLimit"> = {
  roles: ["respondent"],
  route: "/api/workbench/evidence/upload",
  mutationRateLimit: false,
};

export const POST = withRoute(
  { ...routeOptions, logMessage: "Failed to initialize evidence upload" },
  initializeEvidenceUpload,
);

export const PATCH = withRoute(
  { ...routeOptions, logMessage: "Failed to verify evidence upload" },
  verifyEvidenceUpload,
);
