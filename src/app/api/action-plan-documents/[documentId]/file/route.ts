import { NextResponse } from "next/server";
import { ensureOrganizationAccess } from "@/infrastructure/api/tenant-guard";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { ACTION_PLAN_DOCUMENT_BUCKET } from "@/features/improvement-management/server";

const SIGNED_URL_TTL_SECONDS = 60;

export const GET = withRoute<{ documentId: string }>(
  {
    roles: ["admin", "respondent"],
    route: "/api/action-plan-documents/[documentId]/file",
    logMessage: "Failed to sign action-plan document download",
  },
  async ({ request, auth, params }) => {
    const documentId = requireUuid(params.documentId, "documentId");
    const supabase = createSupabaseServiceRoleClient();
    const { data: document, error } = await supabase
      .from("action_plan_documents")
      .select(
        "id,organization_id,kind,storage_path,original_filename,file_validation_status,deactivated_at",
      )
      .eq("id", documentId)
      .maybeSingle();
    if (error) throw error;
    if (!document || document.deactivated_at !== null) {
      return NextResponse.json({ error: "Comprovação não encontrada." }, { status: 404 });
    }

    const denied = ensureOrganizationAccess(auth, document.organization_id);
    if (denied) return denied;

    if (document.kind !== "file" || !document.storage_path) {
      return NextResponse.json(
        { error: "A comprovação informada não possui arquivo armazenado." },
        { status: 409 },
      );
    }
    if (document.file_validation_status !== "valid") {
      return NextResponse.json(
        { error: "O arquivo ainda não possui validação estrutural concluída." },
        { status: 409 },
      );
    }

    const download = new URL(request.url).searchParams.get("download") === "1";
    const signedOptions = download
      ? { download: document.original_filename ?? true }
      : undefined;
    const { data: signed, error: signedError } = await supabase.storage
      .from(ACTION_PLAN_DOCUMENT_BUCKET)
      .createSignedUrl(document.storage_path, SIGNED_URL_TTL_SECONDS, signedOptions);
    if (signedError || !signed?.signedUrl) {
      throw signedError ?? new Error("signed_action_plan_document_url_missing");
    }

    const signedUrl = new URL(signed.signedUrl);
    if (!["http:", "https:"].includes(signedUrl.protocol)) {
      throw new Error("invalid_signed_action_plan_document_url_protocol");
    }

    const response = NextResponse.redirect(signedUrl, 307);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  },
);
