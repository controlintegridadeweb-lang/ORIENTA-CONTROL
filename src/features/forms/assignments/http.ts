import { NextResponse } from "next/server";
import { FormAssignmentAccessError } from "./errors";

/**
 * Garante que respondentes só acessem formulários explicitamente atribuídos.
 * Admin bypassa a checagem (supervisão e preview).
 */
export async function ensureRespondentAssignmentAccess(
  role: string,
  formId: string,
  organizationId: string,
): Promise<NextResponse | null> {
  if (role === "admin") return null;
  const { assertOrganizationAssignedToForm } = await import("./service");
  try {
    await assertOrganizationAssignedToForm(formId, organizationId);
    return null;
  } catch (error) {
    if (error instanceof FormAssignmentAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
