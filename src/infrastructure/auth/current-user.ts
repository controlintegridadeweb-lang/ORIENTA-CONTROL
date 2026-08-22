import { redirect } from "next/navigation";
import { createSupabaseServerActionClient } from "@/infrastructure/supabase/auth-server";
import { displayNameFromProfile, type ProfilePreferences } from "@/infrastructure/auth/profile-types";
import { logError } from "@/infrastructure/observability/logger";
import type { AppRole } from "@/infrastructure/auth/types";
import { readMfaAssurance } from "@/infrastructure/auth/mfa";

export type { AppRole };

export class CurrentUserProfileError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "CurrentUserProfileError";
  }
}

export type CurrentUser = {
  userId: string;
  email: string | null;
  role: AppRole;
  organizationId: string | null;
  fullName: string | null;
  organizationName: string | null;
  preferences: ProfilePreferences;
  mfaVerified: boolean;
};

function organizationNameFromProfile(profile: {
  organizations?: { name: string } | { name: string }[] | null;
}): string | null {
  const o = profile.organizations;
  if (Array.isArray(o)) return o[0]?.name ?? null;
  return o?.name ?? null;
}

export function getCurrentUserDisplayName(user: CurrentUser): string {
  return displayNameFromProfile(user.fullName, user.email);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerActionClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, organization_id, full_name, preferences, organizations(name)")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    logError("Failed to load profile for current user", profileError, {
      userId: authData.user.id,
      where: "getCurrentUser",
    });
    throw new CurrentUserProfileError(
      "Não foi possível carregar o perfil do usuário autenticado.",
      profileError,
    );
  }
  if (!profile?.role) {
    // Sessão Auth sem linha em public.profiles: limpa cookie e volta ao login.
    await supabase.auth.signOut();
    return null;
  }

  const assurance = await readMfaAssurance(supabase);

  const rawPrefs = profile.preferences;
  const preferences: ProfilePreferences =
    rawPrefs && typeof rawPrefs === "object" && !Array.isArray(rawPrefs)
      ? (rawPrefs as ProfilePreferences)
      : {};

  return {
    userId: authData.user.id,
    email: authData.user.email ?? null,
    role: profile.role as AppRole,
    organizationId: (profile.organization_id as string | null) ?? null,
    fullName: (profile.full_name as string | null) ?? null,
    organizationName: organizationNameFromProfile(
      profile as { organizations?: { name: string } | { name: string }[] | null },
    ),
    preferences,
    mfaVerified: assurance.verified,
  };
}

export function homeRouteForRole(role: AppRole): string {
  if (role === "admin") return "/admin";
  return "/respondente";
}

export async function requireRole(allowed: AppRole[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (!allowed.includes(user.role)) redirect(homeRouteForRole(user.role));
  if (user.role === "admin" && !user.mfaVerified) {
    redirect("/auth/mfa?redirect=%2Fadmin");
  }
  return user;
}
