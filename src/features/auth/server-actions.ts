"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { passwordRecoveryRedirectUrl } from "@/shared/config/app-url";
import { createSupabaseServerActionClient } from "@/infrastructure/supabase/auth-server";
import { logError } from "@/infrastructure/observability/logger";
import { consumeRateLimit, type RateLimitResult } from "@/infrastructure/security/rate-limit";
import { normalizedEmailSubject, requestNetworkSubject } from "@/infrastructure/security/request-subject";

export type AuthFormState = {
  status: "idle" | "error" | "success";
  message?: string;
};

const passwordResetFormSchema = z
  .object({
    email: z.email("Informe um e-mail válido para recuperar a senha."),
  })
  .strict();

export async function requestPasswordResetAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = passwordResetFormSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Informe seu e-mail para recuperar a senha.",
    };
  }
  const email = parsed.data.email;

  const headerStore = await headers();
  const networkSubject = requestNetworkSubject(headerStore);
  const emailSubject = normalizedEmailSubject(email);
  let accountRate: RateLimitResult;
  let networkRate: RateLimitResult;
  try {
    [accountRate, networkRate] = await Promise.all([
      consumeRateLimit({
        scope: "auth:password-reset:account-network",
        subject: `${networkSubject}:${emailSubject}`,
        limit: 3,
        windowSeconds: 60 * 60,
      }),
      consumeRateLimit({
        scope: "auth:password-reset:network",
        subject: networkSubject,
        limit: 12,
        windowSeconds: 60 * 60,
      }),
    ]);
  } catch (error) {
    logError("Falha ao consultar o rate limit de recuperação de senha", error, {
      where: "requestPasswordResetAction",
    });
    return {
      status: "error",
      message: "Não foi possível validar a solicitação. Tente novamente.",
    };
  }
  if (!accountRate.allowed || !networkRate.allowed) {
    return {
      status: "error",
      message: "Muitas tentativas em pouco tempo. Aguarde antes de solicitar outro link.",
    };
  }

  const redirectTo = passwordRecoveryRedirectUrl(headerStore.get("origin"));
  const supabase = await createSupabaseServerActionClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    logError("Falha ao enviar e-mail de recuperação", error, {
      where: "requestPasswordResetAction",
      redirectTo,
    });
    return { status: "error", message: describePasswordResetError(error) };
  }

  return {
    status: "success",
    message: "Se houver uma conta para este e-mail, o link de recuperação será enviado.",
  };
}

function describePasswordResetError(error: { message?: string; code?: string }): string {
  const raw = `${error.message ?? ""} ${error.code ?? ""}`.toLowerCase();
  if (raw.includes("rate limit") || raw.includes("rate_limit") || raw.includes("too many")) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  }
  return "Não foi possível enviar o e-mail de recuperação. Tente novamente ou contate a equipe responsável.";
}

export async function logoutAction() {
  const supabase = await createSupabaseServerActionClient();
  await supabase.auth.signOut();
  redirect("/");
}
