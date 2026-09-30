import { validatePassword } from "@/infrastructure/auth/password-policy";

export type PasswordUpdateError = {
  message: string;
  code?: string;
};

export type ChangeOwnPasswordInput = {
  userId: string;
  email: string;
  currentPassword: string;
  newPassword: string;
};

export type ChangeOwnPasswordDeps = {
  verifyPassword: (email: string, password: string) => Promise<{ userId: string; release: () => Promise<void> } | null>;
  updatePassword: (
    password: string,
    currentPassword: string,
  ) => Promise<PasswordUpdateError | null>;
};

export type ChangeOwnPasswordResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

const GENERIC_UPDATE_ERROR = "Não foi possível atualizar a senha. Tente de novo.";

function mapPasswordUpdateError(error: PasswordUpdateError): string {
  const code = error.code ?? "";
  const message = error.message.toLowerCase();

  if (code === "insufficient_aal" || message.includes("aal2")) {
    return "A sessão precisa da autenticação em duas etapas para alterar a senha. Saia, entre novamente e confirme o código do aplicativo.";
  }
  if (
    code === "reauthentication_needed" ||
    code === "reauth_nonce_missing" ||
    message.includes("reauthentication")
  ) {
    return "Sua sessão não é recente o bastante para trocar a senha. Saia, entre novamente e tente de novo.";
  }
  if (code === "same_password" || message.includes("different from the old password")) {
    return "A nova senha deve ser diferente da atual.";
  }
  if (code === "weak_password") {
    return "A nova senha não atende à política de segurança. Use maiúscula, minúscula, número e símbolo.";
  }
  if (code === "over_request_rate_limit" || message.includes("rate limit")) {
    return "Muitas tentativas em pouco tempo. Aguarde e tente novamente.";
  }
  if (message.includes("current password")) {
    return "Senha atual incorreta.";
  }
  return GENERIC_UPDATE_ERROR;
}

export async function changeOwnPassword(
  input: ChangeOwnPasswordInput,
  deps: ChangeOwnPasswordDeps,
): Promise<ChangeOwnPasswordResult> {
  const policy = validatePassword(input.newPassword, "A nova senha");
  if (!policy.ok) {
    return { ok: false, status: 400, error: policy.message };
  }
  if (input.newPassword === input.currentPassword) {
    return { ok: false, status: 400, error: "A nova senha deve ser diferente da atual." };
  }

  let verified: { userId: string; release: () => Promise<void> } | null;
  try {
    verified = await deps.verifyPassword(input.email, input.currentPassword);
  } catch {
    return {
      ok: false,
      status: 503,
      error: "Não foi possível validar a senha atual. Tente novamente.",
    };
  }

  if (!verified || verified.userId !== input.userId) {
    await verified?.release();
    return { ok: false, status: 401, error: "Senha atual incorreta." };
  }

  try {
    const updateError = await deps.updatePassword(input.newPassword, input.currentPassword);
    if (updateError) {
      return { ok: false, status: 400, error: mapPasswordUpdateError(updateError) };
    }
    return { ok: true };
  } finally {
    await verified.release();
  }
}
