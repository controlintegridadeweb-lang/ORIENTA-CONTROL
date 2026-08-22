import type { SupabaseClient } from "@supabase/supabase-js";

export type MfaAssurance = {
  currentLevel: "aal1" | "aal2" | null;
  nextLevel: "aal1" | "aal2" | null;
  verified: boolean;
};

function asAssuranceLevel(
  value: string | null | undefined,
): "aal1" | "aal2" | null {
  return value === "aal1" || value === "aal2" ? value : null;
}

export async function readMfaAssurance(client: SupabaseClient): Promise<MfaAssurance> {
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  const currentLevel = asAssuranceLevel(data.currentLevel);
  return {
    currentLevel,
    nextLevel: asAssuranceLevel(data.nextLevel),
    verified: currentLevel === "aal2",
  };
}
