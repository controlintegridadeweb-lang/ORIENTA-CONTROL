"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AppRole } from "@/infrastructure/auth/current-user";
import { requireRole } from "@/infrastructure/auth/current-user";
import {
  createRespondentSchema,
  createRespondentUser,
  removeUserAdmin,
  sendPasswordResetLinkAdmin,
  updateUserProfileAdmin,
} from "@/features/admin/users-service";
import type { RespondentAccessMethod } from "@/features/admin/users-service";
import { userFacingErrorMessage } from "@/infrastructure/api/user-facing-error";

const EDITABLE_ROLES = ["respondent"] as const satisfies readonly AppRole[];

const userIdFormSchema = z.object({
  userId: z.string().trim().uuid("Identificador do usuário inválido."),
}).strict();

const saveUserProfileFormSchema = z
  .object({
    userId: z.string().trim().uuid("Identificador do usuário inválido."),
    fullName: z.string().trim().max(160, "Nome muito longo (máx. 160 caracteres)."),
    email: z.string().trim().pipe(z.email("Informe um e-mail válido.")),
    role: z.enum(EDITABLE_ROLES),
    organizationId: z.string().trim().uuid("Selecione uma organização válida."),
  })
  .strict();

function firstSchemaMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

export type CreateRespondentState = {
  status: "idle" | "error" | "success";
  message?: string;
  /** Link manual quando o SMTP não conseguiu entregar o convite. */
  recoveryLink?: string | null;
  accessMethod?: RespondentAccessMethod;
};

export async function createRespondentAction(
  _prevState: CreateRespondentState,
  formData: FormData,
): Promise<CreateRespondentState> {
  const actor = await requireRole(["admin"]);
  const parsed = createRespondentSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    organizationId: formData.get("organizationId"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", message: firstSchemaMessage(parsed.error) };
  }

  try {
    const result = await createRespondentUser({
      ...parsed.data,
      fullName: parsed.data.fullName ?? null,
      password: parsed.data.password ?? null,
      actorUserId: actor.userId,
    });
    revalidatePath("/admin/usuarios");
    return {
      status: "success",
      message:
        result.accessMethod === "temporary_password"
          ? `Respondente ${result.email} criado com senha provisória.`
          : result.accessMethod === "email"
            ? `Respondente ${result.email} criado e solicitação de definição de senha enviada ao provedor de e-mail.`
            : `Respondente ${result.email} criado. Envie o link exibido por um canal seguro.`,
      recoveryLink: result.recoveryLink,
      accessMethod: result.accessMethod,
    };
  } catch (error) {
    return { status: "error", message: userFacingErrorMessage(error, "Não foi possível criar o respondente.") };
  }
}

export async function saveUserProfileAction(formData: FormData) {
  const actor = await requireRole(["admin"]);
  const parsed = saveUserProfileFormSchema.safeParse({
    userId: formData.get("userId"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    role: formData.get("role"),
    organizationId: formData.get("organizationId"),
  });
  if (!parsed.success) throw new Error(firstSchemaMessage(parsed.error));

  await updateUserProfileAdmin({
    userId: parsed.data.userId,
    fullName: parsed.data.fullName || null,
    email: parsed.data.email,
    role: parsed.data.role,
    organizationId: parsed.data.organizationId,
    actorUserId: actor.userId,
  });

  revalidatePath("/admin/usuarios");
}

export async function resetPasswordAction(formData: FormData): Promise<{
  recoveryLink: string | null;
  message: string;
}> {
  await requireRole(["admin"]);
  const parsed = userIdFormSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) throw new Error(firstSchemaMessage(parsed.error));

  const { recoveryLink, accessMethod } = await sendPasswordResetLinkAdmin(parsed.data.userId);
  return {
    recoveryLink,
    message:
      accessMethod === "recovery_link"
        ? "O e-mail não pôde ser solicitado. Use o link alternativo de recuperação."
        : "Solicitação de recuperação enviada ao provedor de e-mail.",
  };
}

export async function removeUserAction(formData: FormData) {
  const actor = await requireRole(["admin"]);
  const parsed = userIdFormSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) throw new Error(firstSchemaMessage(parsed.error));

  await removeUserAdmin(actor.userId, parsed.data.userId);
  revalidatePath("/admin/usuarios");
}
