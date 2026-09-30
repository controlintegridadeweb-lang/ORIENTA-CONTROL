import { NextResponse } from "next/server";
import { z } from "zod";
import { changeOwnPassword } from "@/features/profile/change-own-password";
import { withRoute } from "@/infrastructure/api/with-route";
import { verifyCurrentPassword } from "@/infrastructure/auth/verify-current-password";
import { logError } from "@/infrastructure/observability/logger";
import { createSupabaseServerActionClient } from "@/infrastructure/supabase/auth-server";

const bodySchema = z
  .object({
    currentPassword: z.string().min(1).max(1024),
    newPassword: z.string().min(1).max(1024),
  })
  .strict();

export const POST = withRoute(
  {
    roles: ["admin", "respondent"],
    route: "/api/profile/password",
    logMessage: "Failed to change password",
    internalErrorMessage: "Não foi possível atualizar a senha. Tente de novo.",
    mutationRateLimit: { limit: 8, windowSeconds: 15 * 60 },
  },
  async ({ request, auth }) => {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Informe a senha atual e a nova senha." },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerActionClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const email = userData.user?.email ?? null;
    if (userError || !userData.user || userData.user.id !== auth.userId || !email) {
      return NextResponse.json(
        { error: "Não foi possível identificar o e-mail da conta. Contate o administrador." },
        { status: 400 },
      );
    }

    const result = await changeOwnPassword(
      {
        userId: auth.userId,
        email,
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      },
      {
        verifyPassword: verifyCurrentPassword,
        updatePassword: async (password, currentPassword) => {
          const { error } = await supabase.auth.updateUser({
            password,
            current_password: currentPassword,
          });
          if (!error) return null;
          logError("Falha ao gravar a nova senha", error, {
            route: "/api/profile/password",
            userId: auth.userId,
            code: "code" in error ? error.code : undefined,
          });
          return {
            message: error.message,
            code: "code" in error && typeof error.code === "string" ? error.code : undefined,
          };
        },
      },
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true });
  },
);
