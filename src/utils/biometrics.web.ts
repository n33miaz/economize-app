/**
 * Desbloqueio biométrico na web, via WebAuthn.
 *
 * <p>É o mesmo contrato de `biometrics.ts`, e existe porque no navegador o
 * `expo-local-authentication` simplesmente responde "sem hardware": o app
 * aberto no Chrome do Android ou no Safari do iPhone ficava sem a tranca que o
 * APK tem, mesmo com o leitor de digital do aparelho ali.
 *
 * <p><b>Autenticador de plataforma, e só ele.</b>
 * `authenticatorAttachment: "platform"` + `userVerification: "required"`
 * significam a digital/rosto DESTE aparelho — nunca uma chave USB, nunca um
 * celular pareado por QR. É a tradução exata do que a tranca do app faz.
 *
 * <p><b>Onde mora o vínculo.</b> A credencial criada fica no aparelho; aqui só
 * guardamos o id dela no `localStorage`, para pedir exatamente aquela na hora
 * de conferir. Limpar os dados do site apaga o vínculo — e a tranca degrada
 * para "biometria indisponível", que o app já sabe tratar. Nada disso viaja
 * para o servidor: a assinatura não é verificada por ninguém, porque isto é
 * uma tranca local sobre uma sessão já autenticada, e não um fator de login.
 * O segundo fator de verdade é o TOTP, que o servidor confere.
 */

export type BiometricUnavailable =
  | "no-hardware"
  | "not-enrolled"
  | "unsupported";

export interface BiometricSupport {
  available: boolean;
  reason?: BiometricUnavailable;
}

const CREDENTIAL_KEY = "@economize_webauthn_credential";

/** WebAuthn só existe em contexto seguro (https ou localhost). */
function platformReady(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(window.isSecureContext) &&
    Boolean(navigator.credentials) &&
    typeof window.PublicKeyCredential !== "undefined"
  );
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // navegação privada e "bloquear dados de sites" fazem o acesso ESTOURAR,
    // não devolver null: sem o try o app inteiro morria ao abrir
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // sem armazenamento não há vínculo a guardar; o app segue sem a tranca
  }
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export async function biometricSupport(): Promise<BiometricSupport> {
  if (!platformReady()) return { available: false, reason: "unsupported" };
  try {
    const has =
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!has) return { available: false, reason: "no-hardware" };
    return { available: true };
  } catch {
    return { available: false, reason: "unsupported" };
  }
}

/**
 * Cria a credencial deste aparelho. O navegador só conclui depois de o usuário
 * confirmar com a digital/rosto, então criar e confirmar são um gesto só —
 * igual ao celular.
 */
export async function enrollBiometrics(label: string): Promise<boolean> {
  if (!platformReady()) return false;
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { name: "Economize!", id: window.location.hostname },
        user: {
          // O id identifica a credencial no aparelho e nunca sai dele — não
          // carrega e-mail nem nada que valha a pena vazar
          id: randomBytes(16),
          name: label,
          displayName: label,
        },
        // ES256 e RS256: o par que todo autenticador de plataforma suporta
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;
    if (!credential) return false;
    writeStorage(CREDENTIAL_KEY, toBase64Url(credential.rawId));
    return true;
  } catch {
    // recusar o prompt do navegador cai aqui, e é resposta legítima
    return false;
  }
}

export async function verifyBiometrics(_promptMessage: string): Promise<boolean> {
  if (!platformReady()) return false;
  const stored = readStorage(CREDENTIAL_KEY);
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        rpId: window.location.hostname,
        // Sem credencial guardada (outro navegador, dados limpos) a lista vai
        // vazia: o navegador oferece o que tiver para este domínio em vez de
        // falhar de saída
        allowCredentials: stored
          ? [{ type: "public-key", id: fromBase64Url(stored) }]
          : [],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return Boolean(assertion);
  } catch {
    return false;
  }
}

export function forgetBiometrics(): void {
  if (typeof window === "undefined") return;
  writeStorage(CREDENTIAL_KEY, null);
}
