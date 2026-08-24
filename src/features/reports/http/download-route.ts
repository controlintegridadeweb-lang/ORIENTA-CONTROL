import { NextResponse } from "next/server";
import { ensureOrganizationAccess } from "@/infrastructure/api/tenant-guard";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { REPORTS_BUCKET } from "@/features/reports/pdf/report-file-path";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";

const SIGNED_URL_TTL_SECONDS = 60;

function first<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type ReportDownloadRow = {
  id: string;
  status: string;
  file_path: string | null;
  file_sha256: string | null;
  file_size_bytes: number | null;
  emission_version: number;
  cycle_processings:
    | { processing_version: number }
    | { processing_version: number }[]
    | null;
  cycles:
    | {
        organization_id: string;
        form_versions:
          | { forms: { name: string } | { name: string }[] | null }
          | { forms: { name: string } | { name: string }[] | null }[]
          | null;
      }
    | {
        organization_id: string;
        form_versions:
          | { forms: { name: string } | { name: string }[] | null }
          | { forms: { name: string } | { name: string }[] | null }[]
          | null;
      }[]
    | null;
};

function applyReportDownloadHeaders(
  response: NextResponse,
  reportId: string,
  integrity: string,
): void {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Report-Id", reportId);
  response.headers.set("X-Report-Integrity", integrity);
}

function safeFilenamePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase();
}

export const GET = withRoute<{ reportId: string }>(
  {
    roles: ["admin", "respondent"],
    route: "/api/reports/[reportId]/download",
    logMessage: "Failed to sign report download",
  },
  async ({ request, auth, params }) => {
    const client = createSupabaseServiceRoleClient();
    const reportId = requireUuid(params.reportId, "reportId");
    const { data, error } = await client
      .from("reports")
      .select(
        "id,status,file_path,file_sha256,file_size_bytes,emission_version," +
          "cycle_processings!inner(processing_version)," +
          "cycles!inner(organization_id,form_versions!inner(forms!form_versions_form_id_fkey!inner(name)))",
      )
      .eq("id", reportId)
      .maybeSingle();
    if (error) throw error;
    // Select aninhado com hints de FK não é inferido pelo tipador gerado.
    const report = data as ReportDownloadRow | null;
    if (!report || !["completed", "legacy"].includes(report.status)) {
      return NextResponse.json({ error: "Relatório oficial não encontrado." }, { status: 404 });
    }

    const cycle = first(report.cycles);
    const organizationId = cycle?.organization_id ?? null;
    if (!organizationId) {
      return NextResponse.json({ error: "Relatório sem organização válida." }, { status: 409 });
    }
    const denied = ensureOrganizationAccess(auth, organizationId);
    if (denied) return denied;

    if (!report.file_path) {
      return NextResponse.json(
        { error: "O relatório não possui arquivo persistido." },
        { status: 409 },
      );
    }
    if (report.status === "completed" && (!report.file_sha256 || !report.file_size_bytes)) {
      return NextResponse.json(
        { error: "O relatório oficial não possui metadados de integridade válidos." },
        { status: 409 },
      );
    }

    const processing = first(report.cycle_processings);
    const formVersion = first(cycle?.form_versions ?? null);
    const form = first(formVersion?.forms ?? null);
    const filename =
      `relatorio-orienta-${safeFilenamePart(form?.name ?? "diagnostico") || "diagnostico"}` +
      `-processamento-${processing?.processing_version ?? "x"}` +
      `-emissao-${report.emission_version}-${reportId.slice(0, 8)}.pdf`;
    const inline = new URL(request.url).searchParams.get("inline") === "1";

    const { data: signed, error: signedError } = await client.storage
      .from(REPORTS_BUCKET)
      .createSignedUrl(
        report.file_path,
        SIGNED_URL_TTL_SECONDS,
        inline ? undefined : { download: filename },
      );
    if (signedError || !signed?.signedUrl) {
      throw signedError ?? new Error("signed_report_url_missing");
    }

    const signedUrl = new URL(signed.signedUrl);
    if (!["http:", "https:"].includes(signedUrl.protocol)) {
      throw new Error("invalid_signed_report_url_protocol");
    }

    const integrity = report.status === "completed" ? "persisted-and-hashed" : "legacy-unverified";
    // O browser não expõe Location de 307 no fetch (opaqueredirect). O cliente
    // pede application/json para receber a URL assinada e baixar sem credentials.
    if (request.headers.get("Accept")?.toLowerCase().includes("application/json")) {
      const json = NextResponse.json({ url: signedUrl.toString(), filename });
      applyReportDownloadHeaders(json, reportId, integrity);
      return json;
    }

    const response = NextResponse.redirect(signedUrl, 307);
    applyReportDownloadHeaders(response, reportId, integrity);
    return response;
  },
);
