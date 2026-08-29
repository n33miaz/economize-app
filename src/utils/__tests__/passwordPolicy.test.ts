import {
  getPasswordStrength,
  validateNewPassword,
} from "../passwordPolicy";

describe("passwordPolicy", () => {
  describe("getPasswordStrength", () => {
    it("classifica senhas curtas ou monótonas como fracas", () => {
      expect(getPasswordStrength("")).toBe("fraca");
      expect(getPasswordStrength("abc")).toBe("fraca");
      expect(getPasswordStrength("abcdefgh")).toBe("fraca");
      expect(getPasswordStrength("12345678")).toBe("fraca");
    });

    it("classifica 8+ caracteres com duas classes como média", () => {
      expect(getPasswordStrength("abcdef12")).toBe("média");
      expect(getPasswordStrength("Abcdefgh")).toBe("média");
    });

    it("classifica 12+ caracteres com três classes como forte", () => {
      expect(getPasswordStrength("Abcdef123456")).toBe("forte");
      expect(getPasswordStrength("abcdef-123456")).toBe("forte");
    });
  });

  describe("validateNewPassword", () => {
    it("aponta senha abaixo do mínimo de 8", () => {
      const result = validateNewPassword("1234567", "1234567");
      expect(result.passwordError).toMatch(/pelo menos 8/);
      expect(result.confirmationError).toBeNull();
    });

    it("aponta confirmação vazia e divergente", () => {
      expect(validateNewPassword("senha-valida", "").confirmationError).toBe(
        "Confirme a nova senha.",
      );
      expect(
        validateNewPassword("senha-valida", "senha-diferente")
          .confirmationError,
      ).toBe("As senhas não coincidem.");
    });

    it("aceita senha válida com confirmação igual", () => {
      const result = validateNewPassword("senha-valida", "senha-valida");
      expect(result.passwordError).toBeNull();
      expect(result.confirmationError).toBeNull();
    });
  });
});
