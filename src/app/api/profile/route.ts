import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServerActionClient } from "@/infrastructure/supabase/auth-server";
import type { Json } from "@/infrastructure/supabase/database.types";

const patchSchema = z.object({
  fullName: z.string().max(500).optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
});

function toJsonObject(
  value: Record<string, unknown>,
): { [key: string]: Json | undefined } {
  return value as { [key: string]: Json | undefined };
}

/** Atualiza nome e preferências do próprio perfil (sessão; RLS e trigger em `profiles`). */
export const PATCH = withRoute(
  {
    roles: ["admin", "respondent"],
    route: "/api/profile",
    logMessage: "Failed to update profile",
    internalErrorMessage: "Falha ao atualizar o perfil.",
  },
  async ({ request, auth }) => {
    const body = await request.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const updates: {
      full_name?: string | null;
      preferences?: Json;
    } = {};

    if (parsed.data.fullName !== undefined) {
      const fullName = parsed.data.fullName.trim();
      updates.full_name = fullName.length > 0 ? fullName : null;
    }
    if (parsed.data.preferences !== undefined) {
      updates.preferences = toJsonObject(parsed.data.preferences);
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo para atualizar." },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerActionClient();
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", auth.userId)
      .select("full_name, preferences")
      .single();
    if (error) throw error;

    const rawPreferences = data?.preferences;
    const preferences =
      rawPreferences &&
      typeof rawPreferences === "object" &&
      !Array.isArray(rawPreferences)
        ? (rawPreferences as Record<string, unknown>)
        : {};

    return NextResponse.json({
      ok: true,
      profile: {
        fullName: (data?.full_name as string | null) ?? null,
        preferences,
      },
    });
  },
);
