import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerActionClient } from "@/infrastructure/supabase/auth-server";
import { consumeRateLimit, type RateLimitResult } from "@/infrastructure/security/rate-limit";
import { rejectCrossSiteMutation } from "@/infrastructure/security/csrf";
import {
  normalizedEmailSubject,
  requestNetworkSubject,
} from "@/infrastructure/security/request-subject";
import { logError } from "@/infrastructure/observability/logger";

const credentialsSchema = z
  .object({
    email: z.email(),
    password: z.string().min(1).max(1024),
  })
  .strict();

function isRole(value: unknown): value is "admin" | "respondent" {
  return value === "admin" || value === "respondent";
}

function authJson(
  body: Record<string, unknown>,
  init: { status?: number; headers?: HeadersInit } = {},
) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  return NextResponse.json(body, { ...init, headers });
}

export async function POST(request: Request) {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return csrfError;

  const parsed = credentialsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return authJson({ error: "Informe e-mail e senha válidos." }, { status: 400 });
  }

  const emailSubject = normalizedEmailSubject(parsed.data.email);
  const networkSubject = requestNetworkSubject(request.headers);
  let accountRate: RateLimitResult;
  let networkRate: RateLimitResult;
  try {
    [accountRate, networkRate] = await Promise.all([
      consumeRateLimit({
        scope: "auth:sign-in:account-network",
        subject: `${networkSubject}:${emailSubject}`,
        limit: 8,
        windowSeconds: 15 * 60,
      }),
      consumeRateLimit({
        scope: "auth:sign-in:network",
        subject: networkSubject,
        limit: 40,
        windowSeconds: 15 * 60,
      }),
    ]);
  } catch (error) {
    logError("Falha ao consultar o rate limit de login.", error, {
      route: "/api/auth/sign-in",
    });
    return authJson(
      { error: "Não foi possível validar a tentativa de acesso. Tente novamente." },
      { status: 503 },
    );
  }

  if (!accountRate.allowed || !networkRate.allowed) {
    const retryAfter = Math.max(
      accountRate.retryAfterSeconds,
      networkRate.retryAfterSeconds,
    );
    return authJson(
      { error: "Muitas tentativas em pouco tempo. Aguarde e tente novamente." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  try {
    const supabase = await createSupabaseServerActionClient();
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error || !data.user) {
      return authJson({ error: "E-mail ou senha inválidos." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (profileError || !isRole(profile?.role)) {
      await supabase.auth.signOut();
      return authJson(
        { error: "Não foi possível carregar o perfil. Tente novamente." },
        { status: profileError ? 503 : 403 },
      );
    }

    let requiresMfa = false;
    if (profile.role === "admin") {
      const { data: assurance, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) {
        await supabase.auth.signOut();
        return authJson(
          { error: "Não foi possível verificar a autenticação em duas etapas." },
          { status: 503 },
        );
      }
      requiresMfa = assurance.currentLevel !== "aal2";
    }

    return authJson({ role: profile.role, requiresMfa });
  } catch (error) {
    logError("Falha no login autenticado.", error, { route: "/api/auth/sign-in" });
    return authJson(
      { error: "Não foi possível entrar. Tente novamente." },
      { status: 500 },
    );
  }
}
