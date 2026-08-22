import "server-only";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import type { AppRole } from "@/infrastructure/auth/current-user";
import {
  DomainConflictError,
  DomainUnavailableError,
  DomainValidationError,
} from "@/infrastructure/api/domain-errors";
import { logError } from "@/infrastructure/observability/logger";
import {
  buildPasswordRecoveryLink,
  passwordRecoveryRedirectUrl,
} from "@/shared/config/app-url";
import { MIN_PASSWORD_LENGTH, validatePassword } from "@/infrastructure/auth/password-policy";

export type ListedUserRow = {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: AppRole;
  organizationId: string | null;
  createdAt: string;
};

export type ListUsersForAdminQuery = {
  search?: string;
  organizationId?: string;
  role?: AppRole;
  limit: number;
  offset: number;
};

export type ListedUsersPage = {
  items: ListedUserRow[];
  total: number;
  limit: number;
  offset: number;
};

export async function listUsersForAdmin(
  query: ListUsersForAdminQuery,
): Promise<ListedUsersPage> {
  const client = createSupabaseServiceRoleClient();
  const { data, error } = await client.rpc("list_admin_users_page", {
    p_search: query.search?.trim() || undefined,
    p_organization_id: query.organizationId || undefined,
    p_role: query.role || undefined,
    p_limit: query.limit,
    p_offset: query.offset,
  });
  if (error) throw error;

  const rows = data ?? [];
  return {
    items: rows.map((row) => ({
      userId: row.user_id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      organizationId: row.organization_id,
      createdAt: row.created_at,
    })),
    total: Number(rows[0]?.total_count ?? 0),
    limit: query.limit,
    offset: query.offset,
  };
}

const EDITABLE_ROLES = ["respondent"] as const;

function duplicateEmailError(error: { message?: string | null }): boolean {
  return /already.*registered|exists|duplicate/i.test(error.message ?? "");
}

async function deleteAuthUserChecked(
  client: ReturnType<typeof createSupabaseServiceRoleClient>,
  userId: string,
): Promise<void> {
  const { error } = await client.auth.admin.deleteUser(userId);
  if (error) throw error;
}

export type RespondentAccessMethod =
  | "temporary_password"
  | "email"
  | "recovery_link";

type PasswordAccessDelivery =
  | { accessMethod: "email"; recoveryLink: null }
  | { accessMethod: "recovery_link"; recoveryLink: string };

async function requestPasswordAccess(
  client: ReturnType<typeof createSupabaseServiceRoleClient>,
  email: string,
  logContext: Record<string, unknown>,
): Promise<PasswordAccessDelivery> {
  const redirectTo = passwordRecoveryRedirectUrl();
  const { error: sendError } = await client.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (!sendError) {
    return { accessMethod: "email", recoveryLink: null };
  }

  logError("Password access email request failed", sendError, {
    ...logContext,
    email,
    redirectTo,
  });

  const { data: linkData, error: linkError } = await client.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });
  const hashedToken =
    (linkData?.properties as { hashed_token?: string } | undefined)?.hashed_token?.trim() || null;

  if (linkError || !hashedToken) {
    logError("Password access recovery link generation failed", linkError, {
      ...logContext,
      email,
      redirectTo,
      missingHashedToken: !hashedToken,
    });
    throw new DomainUnavailableError(
      "Não foi possível gerar o acesso do respondente. Verifique a configuração de e-mail e as URLs de autenticação e tente novamente.",
    );
  }

  return {
    accessMethod: "recovery_link",
    recoveryLink: buildPasswordRecoveryLink(hashedToken),
  };
}

export async function updateUserProfileAdmin(input: {
  userId: string;
  fullName: string | null;
  email: string;
  role: AppRole;
  organizationId: string | null;
  actorUserId: string;
}): Promise<void> {
  const client = createSupabaseServiceRoleClient();

  const emailParsed = z.email("Informe um e-mail válido.").safeParse(input.email.trim());
  if (!emailParsed.success) {
    throw new DomainValidationError([
      { path: "email", message: emailParsed.error.issues[0]?.message ?? "Informe um e-mail válido." },
    ]);
  }
  const nextEmail = emailParsed.data;

  const { data: target, error: fetchErr } = await client
    .from("profiles")
    .select("role,full_name,organization_id")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  const targetRole = target?.role as AppRole | undefined;
  if (!targetRole) throw new Error("Usuário não encontrado.");
  if (targetRole === "admin") throw new Error("Perfis de administrador não são editados aqui.");
  if (input.role === "admin") throw new Error("Promover a administrador não está disponível nesta tela.");
  if (!EDITABLE_ROLES.includes(input.role as (typeof EDITABLE_ROLES)[number])) {
    throw new Error("Papel inválido.");
  }
  if (!input.organizationId) {
    throw new DomainValidationError([
      { path: "organizationId", message: "Selecione uma organização para respondentes." },
    ]);
  }

  const { data: authUser, error: authFetchErr } = await client.auth.admin.getUserById(input.userId);
  if (authFetchErr) throw authFetchErr;
  const currentEmail = authUser.user?.email ?? "";
  if (!currentEmail) throw new Error("O usuário não possui e-mail no provedor de autenticação.");

  const emailChanged = nextEmail.toLocaleLowerCase("pt-BR") !== currentEmail.toLocaleLowerCase("pt-BR");
  if (emailChanged) {
    const { error: emailErr } = await client.auth.admin.updateUserById(input.userId, {
      email: nextEmail,
      email_confirm: true,
    });
    if (emailErr) {
      if (duplicateEmailError(emailErr)) throw new DomainConflictError("Já existe um usuário com esse e-mail.");
      throw emailErr;
    }
  }

  const { error: profileError } = await client.rpc("update_respondent_profile", {
    p_target_user_id: input.userId,
    p_full_name: input.fullName ?? "",
    p_organization_id: input.organizationId,
    p_actor_user_id: input.actorUserId,
  });
  if (!profileError) return;

  if (emailChanged) {
    const { error: rollbackError } = await client.auth.admin.updateUserById(input.userId, {
      email: currentEmail,
      email_confirm: true,
    });
    if (rollbackError) {
      logError("User update compensation failed", rollbackError, {
        userId: input.userId,
        attemptedEmail: nextEmail,
        originalEmail: currentEmail,
        profileError: profileError.message,
      });
      throw new Error("user_update_inconsistent_state");
    }
  }
  throw profileError;
}

export async function sendPasswordResetLinkAdmin(userId: string): Promise<{
  recoveryLink: string | null;
  email: string;
  accessMethod: "email" | "recovery_link";
}> {
  const client = createSupabaseServiceRoleClient();
  const { data: prof, error: profileError } = await client
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (prof?.role === "admin") throw new Error("Reset de administrador não está disponível nesta tela.");

  const { data: u, error } = await client.auth.admin.getUserById(userId);
  if (error) throw error;
  const email = u.user?.email ?? null;
  if (!email) {
    throw new DomainValidationError([
      { path: "email", message: "O usuário não possui e-mail para recuperação de acesso." },
    ]);
  }

  const delivery = await requestPasswordAccess(client, email, { userId });
  return { ...delivery, email };
}

export async function removeUserAdmin(actorUserId: string, userId: string): Promise<void> {
  if (userId === actorUserId) throw new Error("Você não pode remover a própria conta aqui.");

  const client = createSupabaseServiceRoleClient();
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (profile?.role !== "respondent") {
    throw new Error("Remoção permitida apenas para respondentes.");
  }

  await deleteAuthUserChecked(client, userId);
}

function emptyTextToUndefined(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value.trim() ? value : undefined;
}

export const createRespondentSchema = z
  .object({
    email: z.string().trim().pipe(z.email("Informe um e-mail válido.")),
    fullName: z.preprocess(
      emptyTextToUndefined,
      z.string().trim().max(160, "Nome muito longo (máx. 160 caracteres).").optional(),
    ),
    organizationId: z.string().trim().uuid("Selecione uma organização válida."),
    password: z.preprocess(
      emptyTextToUndefined,
      z.string().min(
        MIN_PASSWORD_LENGTH,
        `A senha provisória precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      ).optional(),
    ),
  })
  .strict();

export type CreateRespondentInput = {
  email: string;
  fullName?: string | null;
  organizationId: string;
  password?: string | null;
};

export type CreateRespondentResult = {
  userId: string;
  email: string;
  organizationId: string;
  recoveryLink: string | null;
  accessMethod: RespondentAccessMethod;
};

export async function createRespondentUser(
  input: CreateRespondentInput & { actorUserId: string },
): Promise<CreateRespondentResult> {
  const parsed = createRespondentSchema.safeParse({
    email: input.email,
    fullName: input.fullName ?? undefined,
    organizationId: input.organizationId,
    password: input.password ?? undefined,
  });
  if (!parsed.success) {
    throw new DomainValidationError(parsed.error.issues.map((issue) => ({
      path: String(issue.path[0] ?? ""),
      message: issue.message,
    })));
  }
  const { email, fullName, organizationId, password } = parsed.data;
  if (password) {
    const policy = validatePassword(password, "A senha provisória");
    if (!policy.ok) {
      throw new DomainValidationError([{ path: "password", message: policy.message }]);
    }
  }
  const client = createSupabaseServiceRoleClient();

  const { data: org, error: orgError } = await client
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle();
  if (orgError) throw orgError;
  if (!org) {
    throw new DomainValidationError([{ path: "organizationId", message: "Organização não encontrada." }]);
  }

  // A comunicação só ocorre depois de conta + perfil + auditoria consistentes.
  const generatedPassword = password ?? randomBytes(32).toString("base64url");
  const { data: created, error: createError } = await client.auth.admin.createUser({
    email,
    email_confirm: true,
    password: generatedPassword,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });
  if (createError || !created.user) {
    if (createError && duplicateEmailError(createError)) {
      throw new DomainConflictError("Já existe um usuário com esse e-mail.");
    }
    logError("Failed to create respondent auth user", createError, { email });
    throw createError ?? new Error("Falha ao criar usuário.");
  }

  const userId = created.user.id;
  const { error: profileError } = await client.rpc("create_respondent_profile", {
    p_user_id: userId,
    p_email: email,
    p_full_name: fullName ?? "",
    p_organization_id: organizationId,
    p_actor_user_id: input.actorUserId,
  });
  if (profileError) {
    try {
      await deleteAuthUserChecked(client, userId);
    } catch (rollbackError) {
      logError("Respondent creation compensation failed", rollbackError, {
        userId,
        email,
        organizationId,
        profileError: profileError.message,
      });
      throw new Error("respondent_creation_inconsistent_state");
    }
    throw profileError;
  }

  if (password) {
    return {
      userId,
      email,
      organizationId,
      recoveryLink: null,
      accessMethod: "temporary_password",
    };
  }

  try {
    const delivery = await requestPasswordAccess(client, email, { userId, organizationId });
    return { userId, email, organizationId, ...delivery };
  } catch (accessError) {
    try {
      await deleteAuthUserChecked(client, userId);
    } catch (rollbackError) {
      logError("Respondent access compensation failed", rollbackError, {
        userId,
        email,
        organizationId,
        accessError: accessError instanceof Error ? accessError.message : String(accessError),
      });
      throw new Error("respondent_creation_inconsistent_state");
    }
    throw accessError;
  }
}
