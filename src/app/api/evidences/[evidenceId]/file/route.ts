import { NextResponse } from "next/server";
import { ensureOrganizationAccess } from "@/infrastructure/api/tenant-guard";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { EVIDENCE_BUCKET } from "@/features/evidences/server";

const SIGNED_URL_TTL_SECONDS = 60;

function first<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export const GET = withRoute<{ evidenceId: string }>(
  {
    roles: ["admin", "respondent"],
    route: "/api/evidences/[evidenceId]/file",
    logMessage: "Failed to sign evidence file download",
  },
  async ({ request, auth, params }) => {
    const evidenceId = requireUuid(params.evidenceId, "evidenceId");
    const supabase = createSupabaseServiceRoleClient();
    const { data: evidence, error } = await supabase
      .from("evidences")
      .select(
        "id, kind, storage_path, original_filename, file_validation_status, deactivated_at, responses!inner(cycles!inner(organization_id))",
      )
      .eq("id", evidenceId)
      .maybeSingle();
    if (error) throw error;
    if (!evidence || evidence.deactivated_at !== null) {
      return NextResponse.json({ error: "Evidência não encontrada." }, { status: 404 });
    }

    const response = first(evidence.responses);
    const cycle = first(response?.cycles ?? null);
    if (!cycle?.organization_id) {
      return NextResponse.json(
        { error: "Evidência sem organização válida." },
        { status: 409 },
      );
    }
    const denied = ensureOrganizationAccess(auth, cycle.organization_id);
    if (denied) return denied;

    if (evidence.kind !== "file" || !evidence.storage_path) {
      return NextResponse.json(
        { error: "A evidência informada não possui arquivo armazenado." },
        { status: 409 },
      );
    }
    if (evidence.file_validation_status !== "valid") {
      return NextResponse.json(
        { error: "O arquivo ainda não possui validação estrutural concluída." },
        { status: 409 },
      );
    }

    const download = new URL(request.url).searchParams.get("download") === "1";
    const signedOptions = download
      ? { download: evidence.original_filename ?? true }
      : undefined;
    const { data: signed, error: signedError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrl(evidence.storage_path, SIGNED_URL_TTL_SECONDS, signedOptions);
    if (signedError || !signed?.signedUrl) {
      throw signedError ?? new Error("signed_evidence_file_url_missing");
    }

    const signedUrl = new URL(signed.signedUrl);
    if (!["http:", "https:"].includes(signedUrl.protocol)) {
      throw new Error("invalid_signed_evidence_file_url_protocol");
    }

    const redirect = NextResponse.redirect(signedUrl, 307);
    redirect.headers.set("Cache-Control", "private, no-store, max-age=0");
    redirect.headers.set("Referrer-Policy", "no-referrer");
    redirect.headers.set("X-Content-Type-Options", "nosniff");
    return redirect;
  },
);
