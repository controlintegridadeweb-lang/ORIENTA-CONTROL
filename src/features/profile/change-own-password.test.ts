import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { changeOwnPassword, type ChangeOwnPasswordDeps } from "./change-own-password";

const userId = "11111111-1111-4111-8111-111111111111";
const currentPassword = "SenhaAtual123!";
const newPassword = "SenhaNova123!@";

function deps(overrides: Partial<ChangeOwnPasswordDeps> = {}): ChangeOwnPasswordDeps & {
  release: ReturnType<typeof vi.fn>;
} {
  const release = vi.fn().mockResolvedValue(undefined);
  return {
    release,
    verifyPassword: vi.fn().mockResolvedValue({ userId, release }),
    updatePassword: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe("changeOwnPassword", () => {
  it("rejeita senha fraca sem consultar a senha atual", async () => {
    const client = deps();
    const result = await changeOwnPassword(
      { userId, email: "admin@example.com", currentPassword, newPassword: "curta" },
      client,
    );

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(client.verifyPassword).not.toHaveBeenCalled();
  });

  it("rejeita repetir a senha atual", async () => {
    const client = deps();
    const result = await changeOwnPassword(
      { userId, email: "admin@example.com", currentPassword, newPassword: currentPassword },
      client,
    );

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "A nova senha deve ser diferente da atual.",
    });
    expect(client.verifyPassword).not.toHaveBeenCalled();
  });

  it("não altera a senha quando a atual está incorreta", async () => {
    const client = deps({ verifyPassword: vi.fn().mockResolvedValue(null) });
    const result = await changeOwnPassword(
      { userId, email: "admin@example.com", currentPassword, newPassword },
      client,
    );

    expect(result).toEqual({ ok: false, status: 401, error: "Senha atual incorreta." });
    expect(client.updatePassword).not.toHaveBeenCalled();
  });

  it("encerra a sessão de verificação quando o usuário conferido não é o da sessão", async () => {
    const client = deps();
    const result = await changeOwnPassword(
      {
        userId: "22222222-2222-4222-8222-222222222222",
        email: "admin@example.com",
        currentPassword,
        newPassword,
      },
      client,
    );

    expect(result).toEqual({ ok: false, status: 401, error: "Senha atual incorreta." });
    expect(client.release).toHaveBeenCalledOnce();
    expect(client.updatePassword).not.toHaveBeenCalled();
  });

  it("atualiza a senha na sessão já autenticada e encerra só a verificação", async () => {
    const client = deps();
    const result = await changeOwnPassword(
      { userId, email: "admin@example.com", currentPassword, newPassword },
      client,
    );

    expect(result).toEqual({ ok: true });
    expect(client.verifyPassword).toHaveBeenCalledWith("admin@example.com", currentPassword);
    expect(client.updatePassword).toHaveBeenCalledWith(newPassword, currentPassword);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("explica a recusa quando a sessão não está em AAL2", async () => {
    const client = deps({
      updatePassword: vi.fn().mockResolvedValue({
        code: "insufficient_aal",
        message: "AAL2 session is required to update email or password when MFA is enabled.",
      }),
    });

    const result = await changeOwnPassword(
      { userId, email: "admin@example.com", currentPassword, newPassword },
      client,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("autenticação em duas etapas");
    }
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("mantém a verificação encerrada se a gravação falhar", async () => {
    const client = deps({
      updatePassword: vi.fn().mockRejectedValue(new Error("rede")),
    });

    await expect(
      changeOwnPassword(
        { userId, email: "admin@example.com", currentPassword, newPassword },
        client,
      ),
    ).rejects.toThrow("rede");
    expect(client.release).toHaveBeenCalledOnce();
  });
});

describe("contrato da troca de senha no perfil", () => {
  it("não reautentica no browser, para não rebaixar a sessão AAL2", () => {
    const form = readFileSync(
      resolve(process.cwd(), "src/features/profile/components/profile-edit-form.tsx"),
      "utf8",
    );
    const verifier = readFileSync(
      resolve(process.cwd(), "src/infrastructure/auth/verify-current-password.ts"),
      "utf8",
    );

    expect(form).toContain("/api/profile/password");
    expect(form).not.toContain("signInWithPassword");
    expect(verifier).toContain("createSupabaseEphemeralAuthClient");
    expect(verifier).toContain('scope: "local"');
    expect(verifier).not.toContain("createSupabaseServerActionClient");
  });
});
