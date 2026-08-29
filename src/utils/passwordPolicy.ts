// Regras de senha compartilhadas pelas telas de cadastro, redefinição e troca.
// O backend só exige o mínimo de 8; o resto é orientação visual, não bloqueio.
export const MIN_PASSWORD_LENGTH = 8;

export type PasswordStrength = "fraca" | "média" | "forte";

// Heurística leve: comprimento + variedade de classes de caracteres. Não usa
// lib de propósito — é um indicador discreto, não um medidor de entropia.
export function getPasswordStrength(password: string): PasswordStrength {
  let variety = 0;
  if (/[a-z]/.test(password)) variety += 1;
  if (/[A-Z]/.test(password)) variety += 1;
  if (/\d/.test(password)) variety += 1;
  if (/[^a-zA-Z0-9]/.test(password)) variety += 1;

  if (password.length >= 12 && variety >= 3) return "forte";
  if (password.length >= MIN_PASSWORD_LENGTH && variety >= 2) return "média";
  return "fraca";
}

export interface NewPasswordErrors {
  passwordError: string | null;
  confirmationError: string | null;
}

export function validateNewPassword(
  password: string,
  confirmation: string,
): NewPasswordErrors {
  const passwordError =
    password.length < MIN_PASSWORD_LENGTH
      ? `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`
      : null;

  const confirmationError =
    confirmation.length === 0
      ? "Confirme a nova senha."
      : confirmation !== password
        ? "As senhas não coincidem."
        : null;

  return { passwordError, confirmationError };
}
