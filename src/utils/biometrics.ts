import * as LocalAuthentication from "expo-local-authentication";

/**
 * Desbloqueio biométrico, com uma única porta para as duas plataformas.
 *
 * <p>No celular quem responde é o `expo-local-authentication` (digital, rosto,
 * padrão do aparelho). Na web quem responde é a implementação irmã
 * `biometrics.web.ts`, que fala WebAuthn — o Metro escolhe o arquivo pela
 * plataforma, do mesmo jeito que já faz no `BrandGradient`.
 *
 * <p><b>O que este módulo NÃO é.</b> Não é um fator de autenticação verificado
 * no servidor: é uma tranca LOCAL sobre uma sessão que já foi autenticada por
 * e-mail e senha. Quem tem o token continua tendo o token — a biometria decide
 * se este aparelho abre o app sem digitar a senha de novo. O segundo fator de
 * verdade é o TOTP (Perfil › Segurança), que o servidor confere.
 */

/** Por que a biometria não está disponível — o app fala diferente em cada caso. */
export type BiometricUnavailable =
  | "no-hardware"
  | "not-enrolled"
  | "unsupported";

export interface BiometricSupport {
  available: boolean;
  reason?: BiometricUnavailable;
}

export async function biometricSupport(): Promise<BiometricSupport> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return { available: false, reason: "no-hardware" };
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) return { available: false, reason: "not-enrolled" };
    return { available: true };
  } catch {
    // Aparelho que rejeita a consulta é indistinguível de aparelho sem
    // hardware para quem chama: os dois significam "não ofereça"
    return { available: false, reason: "unsupported" };
  }
}

/**
 * Primeira confirmação, na hora de ligar a preferência. No celular ligar e
 * conferir são o mesmo gesto — não há credencial a criar, só a garantia de
 * que o dono do aparelho está ali.
 */
export async function enrollBiometrics(_label: string): Promise<boolean> {
  return verifyBiometrics("Confirme sua biometria");
}

export async function verifyBiometrics(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: "Cancelar",
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    // authenticateAsync também REJEITA (não só resolve success=false)
    return false;
  }
}

/**
 * Esquece o vínculo deste aparelho. No celular não há nada guardado — quem
 * guarda é o sistema —, mas a porta existe para a web, que precisa apagar a
 * credencial criada no WebAuthn.
 */
export function forgetBiometrics(): void {
  // sem estado local no celular
}
