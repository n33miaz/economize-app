import * as LocalAuthentication from "expo-local-authentication";

import {
  biometricSupport,
  enrollBiometrics,
  forgetBiometrics,
  verifyBiometrics,
} from "../biometrics";

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

const mocked = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;

/**
 * O adaptador de biometria no celular.
 *
 * <p>O que ele existe para garantir é que NENHUMA falha do sistema vire
 * exceção solta: `authenticateAsync` não só resolve `success: false` — ele
 * também REJEITA, e uma rejeição escapando daqui derrubava o login com a
 * sessão retida na closure. Por isso quase todo teste abaixo é sobre o
 * caminho ruim.
 */
describe("biometrics (celular)", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("biometricSupport", () => {
    it("com hardware e digital cadastrada, está disponível", async () => {
      mocked.hasHardwareAsync.mockResolvedValue(true);
      mocked.isEnrolledAsync.mockResolvedValue(true);

      expect(await biometricSupport()).toEqual({ available: true });
    });

    it("sem leitor, diz que falta hardware", async () => {
      mocked.hasHardwareAsync.mockResolvedValue(false);

      expect(await biometricSupport()).toEqual({
        available: false,
        reason: "no-hardware",
      });
      // nem pergunta pelo cadastro: sem leitor a resposta já está decidida
      expect(mocked.isEnrolledAsync).not.toHaveBeenCalled();
    });

    it("com leitor mas sem digital cadastrada, distingue o caso", async () => {
      mocked.hasHardwareAsync.mockResolvedValue(true);
      mocked.isEnrolledAsync.mockResolvedValue(false);

      // A distinção importa para a tela: "seu aparelho não tem" e "cadastre
      // uma digital nos ajustes" são conselhos diferentes
      expect(await biometricSupport()).toEqual({
        available: false,
        reason: "not-enrolled",
      });
    });

    it("consulta que estoura vira indisponível, não exceção", async () => {
      mocked.hasHardwareAsync.mockRejectedValue(new Error("sem permissão"));

      expect(await biometricSupport()).toEqual({
        available: false,
        reason: "unsupported",
      });
    });
  });

  describe("verifyBiometrics", () => {
    it("confirmação bem-sucedida devolve verdadeiro", async () => {
      mocked.authenticateAsync.mockResolvedValue({ success: true } as never);

      expect(await verifyBiometrics("Desbloqueie")).toBe(true);
      expect(mocked.authenticateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ promptMessage: "Desbloqueie" }),
      );
    });

    it("cancelar devolve falso", async () => {
      mocked.authenticateAsync.mockResolvedValue({
        success: false,
        error: "user_cancel",
      } as never);

      expect(await verifyBiometrics("Desbloqueie")).toBe(false);
    });

    it("REJEIÇÃO também vira falso — é o caso que derrubava o login", async () => {
      mocked.authenticateAsync.mockRejectedValue(new Error("indisponível"));

      expect(await verifyBiometrics("Desbloqueie")).toBe(false);
    });

    it("aceita o fallback do aparelho (PIN/padrão)", async () => {
      mocked.authenticateAsync.mockResolvedValue({ success: true } as never);

      await verifyBiometrics("Desbloqueie");

      // Sem isto, quem tem a digital molhada ficaria trancado para fora
      expect(mocked.authenticateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ disableDeviceFallback: false }),
      );
    });
  });

  describe("enrollBiometrics", () => {
    it("no celular, ligar e conferir são o mesmo gesto", async () => {
      mocked.authenticateAsync.mockResolvedValue({ success: true } as never);

      expect(await enrollBiometrics("ana@example.com")).toBe(true);
      // não há credencial a criar aqui — quem guarda é o sistema
      expect(mocked.authenticateAsync).toHaveBeenCalledTimes(1);
    });

    it("não confirmar não liga nada", async () => {
      mocked.authenticateAsync.mockResolvedValue({ success: false } as never);

      expect(await enrollBiometrics("ana@example.com")).toBe(false);
    });
  });

  it("esquecer o vínculo é inócuo no celular, e não estoura", () => {
    // A porta existe para a web, onde há uma credencial WebAuthn a apagar
    expect(() => forgetBiometrics()).not.toThrow();
  });
});
