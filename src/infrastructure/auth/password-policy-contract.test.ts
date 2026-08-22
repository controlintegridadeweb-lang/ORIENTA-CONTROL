import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, minimumPasswordMessage, validatePassword } from "./password-policy";

describe("contrato da política de senha", () => {
  it("mantém mínimo e complexidade alinhados ao Supabase", () => {
    const config = fs.readFileSync(path.join(process.cwd(), "supabase", "config.toml"), "utf8");
    const configured = config.match(/^minimum_password_length\s*=\s*(\d+)$/m);
    const requirements = config.match(/^password_requirements\s*=\s*"([^"]+)"$/m);

    expect(Number(configured?.[1])).toBe(MIN_PASSWORD_LENGTH);
    expect(requirements?.[1]).toBe("lower_upper_letters_digits_symbols");
  });

  it("rejeita senhas sem todos os grupos exigidos", () => {
    expect(validatePassword("somenteletraslongas").ok).toBe(false);
    expect(validatePassword("SenhaSegura123!!").ok).toBe(true);
  });

  it("gera mensagem única para as interfaces", () => {
    expect(minimumPasswordMessage()).toContain(`${MIN_PASSWORD_LENGTH} caracteres`);
    expect(minimumPasswordMessage()).toContain("símbolo");
  });
});
