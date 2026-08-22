import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { AppRole } from "@/infrastructure/auth/types";
import type { Database } from "@/infrastructure/supabase/database.types";
import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";
import { rejectCrossSiteMutation } from "@/infrastructure/security/csrf";

export type { AppRole };

export type AuthContext = {
  userId: string;
  role: AppRole;
  organizationId: string | null;
  mfaVerified: boolean;
};

function errorResponse(message: string, status = 401) {
  return NextResponse.json({ error: message }, { status });
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function isAppRole(value: unknown): value is AppRole {
  return value === "admin" || value === "respondent";
}

type ProfileLookupResult =
  | { status: "ok"; profile: { role: AppRole; organizationId: string | null } }
  | { status: "not_found" }
  | { status: "failed" };

/**
 * Lê o próprio perfil com a sessão do usuário e a policy `profiles_self_read`.
 * A autorização não usa service_role: identidade, papel e organização são
 * resolvidos com o mesmo JWT validado pelo Supabase Auth e continuam sujeitos
 * ao RLS.
 */
async function getOwnProfile(
  client: TypedSupabaseClient,
  userId: string,
): Promise<ProfileLookupResult> {
  const { data, error } = await client
    .from("profiles")
    .select("role,organization_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { status: "failed" };
  if (!data || !isAppRole(data.role)) return { status: "not_found" };
  if (data.organization_id !== null && typeof data.organization_id !== "string") {
    return { status: "failed" };
  }

  return {
    status: "ok",
    profile: {
      role: data.role,
      organizationId: data.organization_id,
    },
  };
}

export type RequireAuthResult =
  | { context: AuthContext; error: null }
  | { context: null; error: NextResponse };

export async function requireAuth(
  request: Request,
  allowedRoles: AppRole[],
): Promise<RequireAuthResult> {
  const csrfError = rejectCrossSiteMutation(request);
  if (csrfError) return { context: null, error: csrfError };

  const identity = await resolveAuthenticatedIdentity(request);
  if (!identity) {
    return { context: null, error: errorResponse("Autenticação obrigatória.", 401) };
  }

  if (identity.profile.status === "failed") {
    return {
      context: null,
      error: errorResponse("Não foi possível carregar o perfil. Tente novamente.", 503),
    };
  }
  if (identity.profile.status === "not_found") {
    return { context: null, error: errorResponse("Perfil não encontrado.", 403) };
  }

  const profile = identity.profile.profile;
  if (!allowedRoles.includes(profile.role)) {
    return { context: null, error: errorResponse("Perfil sem permissão.", 403) };
  }
  if (profile.role === "admin" && !identity.mfaVerified) {
    return {
      context: null,
      error: errorResponse(
        "Autenticação em duas etapas obrigatória para operações administrativas.",
        403,
      ),
    };
  }

  return {
    context: {
      userId: identity.userId,
      role: profile.role,
      organizationId: profile.organizationId,
      mfaVerified: identity.mfaVerified,
    },
    error: null,
  };
}

type AuthenticatedIdentity = {
  userId: string;
  mfaVerified: boolean;
  profile: ProfileLookupResult;
};

async function resolveAuthenticatedIdentity(
  request: Request,
): Promise<AuthenticatedIdentity | null> {
  const token = getBearerToken(request);
  if (token) return resolveIdentityFromBearer(token);
  return resolveIdentityFromCookieSession();
}

async function resolveIdentityFromBearer(
  token: string,
): Promise<AuthenticatedIdentity | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const authClient = createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const [{ data: userData, error: userError }, { data: assurance, error: assuranceError }] =
    await Promise.all([
      authClient.auth.getUser(),
      authClient.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
  if (userError || assuranceError || !userData.user) return null;

  return {
    userId: userData.user.id,
    mfaVerified: assurance.currentLevel === "aal2",
    profile: await getOwnProfile(authClient, userData.user.id),
  };
}

async function resolveIdentityFromCookieSession(): Promise<AuthenticatedIdentity | null> {
  const { createSupabaseServerActionClient } = await import(
    "@/infrastructure/supabase/auth-server"
  );
  const supabase = await createSupabaseServerActionClient();
  const [{ data: userData, error: userError }, { data: assurance, error: assuranceError }] =
    await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
  if (userError || assuranceError || !userData.user) return null;

  return {
    userId: userData.user.id,
    mfaVerified: assurance.currentLevel === "aal2",
    profile: await getOwnProfile(supabase, userData.user.id),
  };
}
