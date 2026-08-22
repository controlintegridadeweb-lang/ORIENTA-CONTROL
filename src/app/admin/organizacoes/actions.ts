"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/infrastructure/auth/current-user";
import {
  createOrganization,
  createOrganizationInputSchema,
} from "@/features/organizations/admin-service";
import { userFacingErrorMessage } from "@/infrastructure/api/user-facing-error";

export type OrgActionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export async function createOrganizationAction(
  _prevState: OrgActionState,
  formData: FormData,
): Promise<OrgActionState> {
  const actor = await requireRole(["admin"]);
  const parsed = createOrganizationInputSchema.safeParse({
    name: formData.get("name"),
    acronym: formData.get("acronym"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Dados da organização inválidos.",
    };
  }

  try {
    const org = await createOrganization({ ...parsed.data, actorUserId: actor.userId });
    revalidatePath("/admin/organizacoes");
    revalidatePath("/admin/usuarios");
    return { status: "success", message: `Organização "${org.name}" (${org.acronym}) cadastrada.` };
  } catch (error) {
    return { status: "error", message: userFacingErrorMessage(error, "Não foi possível concluir a operação.") };
  }
}