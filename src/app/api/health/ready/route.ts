import { NextResponse } from "next/server";
import { getBuildInformation } from "@/infrastructure/health/build-information";
import { isReadinessRequestAuthorized } from "@/infrastructure/health/health-authorization";
import { evaluateReadiness } from "@/infrastructure/health/readiness-service";
import { healthResponseHeaders } from "@/infrastructure/health/response-headers";
import { logError } from "@/infrastructure/observability/logger";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const build = getBuildInformation();
  const headers = healthResponseHeaders(request, build.commit);
  if (!isReadinessRequestAuthorized(request)) return NextResponse.json({ status: "unauthorized" }, { status: 401, headers });
  try {
    const result = await evaluateReadiness();
    return NextResponse.json({ status: result.ready ? "ready" : "not_ready", checkedAt: new Date().toISOString(), ...build, checks: result.checks }, { status: result.ready ? 200 : 503, headers });
  } catch (error) {
    logError("Readiness: falha inesperada", error, { route: "/api/health/ready", requestId: new Headers(headers).get("x-request-id") });
    return NextResponse.json({ status: "not_ready", checkedAt: new Date().toISOString() }, { status: 503, headers });
  }
}
