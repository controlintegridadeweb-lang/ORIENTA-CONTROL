export const MIN_PASSWORD_LENGTH = 12;

const UPPER = /[A-Z]/;
const LOWER = /[a-z]/;
const DIGIT = /\d/;
const SYMBOL = /[^A-Za-z0-9]/;

export type PasswordPolicyResult =
  | { ok: true }
  | { ok: false; message: string };

export function validatePassword(password: string, subject = "A senha"): PasswordPolicyResult {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `${subject} deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.` };
  }
  if (!UPPER.test(password) || !LOWER.test(password) || !DIGIT.test(password) || !SYMBOL.test(password)) {
    return {
      ok: false,
      message: `${subject} deve conter letra maiúscula, letra minúscula, número e símbolo.`,
    };
  }
  return { ok: true };
}

export function minimumPasswordMessage(subject = "A senha"): string {
  return `${subject} deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres e conter letra maiúscula, letra minúscula, número e símbolo.`;
}
