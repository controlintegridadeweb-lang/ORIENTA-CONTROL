import { NextResponse } from "next/server";
import { getBuildInformation } from "@/infrastructure/health/build-information";
import { healthResponseHeaders } from "@/infrastructure/health/response-headers";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  const build = getBuildInformation();
  return NextResponse.json({ status: "ok", checkedAt: new Date().toISOString(), ...build }, { status: 200, headers: healthResponseHeaders(request, build.commit) });
}
