import {
  biometricSupport,
  enrollBiometrics,
  forgetBiometrics,
  verifyBiometrics,
} from "../biometrics.web";

/**
 * O adaptador de biometria na WEB.
 *
 * <p>Existe porque no navegador o `expo-local-authentication` responde
 * simplesmente "sem hardware": o app aberto no Chrome do Android ou no Safari
 * do iPhone ficava sem a tranca que o APK tem, com o leitor de digital do
 * aparelho ali do lado. Quem responde no lugar dele é o WebAuthn.
 *
 * <p>Os testes cobrem os três jeitos de isto não existir — contexto não seguro,
 * navegador antigo, armazenamento bloqueado — porque cada um deles, sem
 * tratamento, é uma exceção na abertura do app.
 */
describe("biometrics (web)", () => {
  const guardado: Record<string, string> = {};
  let credentials: { create: jest.Mock; get: jest.Mock };
  let localStorageMock: {
    getItem: jest.Mock;
    setItem: jest.Mock;
    removeItem: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(guardado)) delete guardado[key];

    credentials = {
      create: jest.fn(),
      get: jest.fn(),
    };
    localStorageMock = {
      getItem: jest.fn((k: string) => guardado[k] ?? null),
      setItem: jest.fn((k: string, v: string) => {
        guardado[k] = v;
      }),
      removeItem: jest.fn((k: string) => {
        delete guardado[k];
      }),
    };

    Object.assign(globalThis, {
      window: {
        isSecureContext: true,
        location: { hostname: "economize-web.onrender.com" },
        localStorage: localStorageMock,
        PublicKeyCredential: {
          isUserVerifyingPlatformAuthenticatorAvailable: jest
            .fn()
            .mockResolvedValue(true),
        },
      },
      navigator: { credentials },
      crypto: {
        getRandomValues: (bytes: Uint8Array) => {
          bytes.fill(7);
          return bytes;
        },
      },
      btoa: (s: string) => Buffer.from(s, "binary").toString("base64"),
      atob: (s: string) => Buffer.from(s, "base64").toString("binary"),
    });
  });

  describe("biometricSupport", () => {
    it("com autenticador de plataforma, está disponível", async () => {
      expect(await biometricSupport()).toEqual({ available: true });
    });

    it("fora de contexto seguro (http), não existe", async () => {
      (globalThis as any).window.isSecureContext = false;

      // WebAuthn simplesmente não roda em http — dizer "sem suporte" é a
      // verdade, e a alternativa era estourar na abertura do app
      expect(await biometricSupport()).toEqual({
        available: false,
        reason: "unsupported",
      });
    });

    it("navegador sem WebAuthn, não existe", async () => {
      delete (globalThis as any).window.PublicKeyCredential;

      expect(await biometricSupport()).toEqual({
        available: false,
        reason: "unsupported",
      });
    });

    it("computador sem leitor devolve indisponível, e não erro", async () => {
      (
        globalThis as any
      ).window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable.mockResolvedValue(
        false,
      );

      expect(await biometricSupport()).toEqual({
        available: false,
        reason: "no-hardware",
      });
    });
  });

  describe("enrollBiometrics", () => {
    it("cria a credencial de PLATAFORMA, exigindo verificação do usuário", async () => {
      credentials.create.mockResolvedValue({
        rawId: new Uint8Array([1, 2, 3, 4]).buffer,
      });

      expect(await enrollBiometrics("ana@example.com")).toBe(true);

      const opcoes = credentials.create.mock.calls[0][0].publicKey;
      // "platform" + "required" são a tradução exata do que a tranca faz:
      // a digital DESTE aparelho, nunca uma chave USB ou um celular pareado
      expect(opcoes.authenticatorSelection).toMatchObject({
        authenticatorAttachment: "platform",
        userVerification: "required",
      });
      expect(opcoes.rp.id).toBe("economize-web.onrender.com");
    });

    it("guarda o id da credencial para pedir exatamente ela depois", async () => {
      credentials.create.mockResolvedValue({
        rawId: new Uint8Array([1, 2, 3, 4]).buffer,
      });

      await enrollBiometrics("ana@example.com");

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "@economize_webauthn_credential",
        expect.any(String),
      );
    });

    it("recusar o prompt do navegador devolve falso, sem estourar", async () => {
      credentials.create.mockRejectedValue(new Error("NotAllowedError"));

      expect(await enrollBiometrics("ana@example.com")).toBe(false);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it("armazenamento bloqueado não impede o cadastro", async () => {
      // navegação privada e "bloquear dados de sites" fazem o acesso ESTOURAR,
      // não devolver null
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error("SecurityError");
      });
      credentials.create.mockResolvedValue({
        rawId: new Uint8Array([1, 2]).buffer,
      });

      expect(await enrollBiometrics("ana@example.com")).toBe(true);
    });
  });

  describe("verifyBiometrics", () => {
    it("a asserção aceita destranca", async () => {
      credentials.get.mockResolvedValue({ id: "abc" });

      expect(await verifyBiometrics("Desbloqueie")).toBe(true);
      expect(credentials.get.mock.calls[0][0].publicKey.userVerification).toBe(
        "required",
      );
    });

    it("pede a credencial guardada, quando existe", async () => {
      guardado["@economize_webauthn_credential"] = "AQIDBA";
      credentials.get.mockResolvedValue({ id: "abc" });

      await verifyBiometrics("Desbloqueie");

      expect(
        credentials.get.mock.calls[0][0].publicKey.allowCredentials,
      ).toHaveLength(1);
    });

    it("sem credencial guardada, deixa o navegador oferecer o que tiver", async () => {
      credentials.get.mockResolvedValue({ id: "abc" });

      await verifyBiometrics("Desbloqueie");

      // dados do site limpos não podem virar "impossível entrar"
      expect(
        credentials.get.mock.calls[0][0].publicKey.allowCredentials,
      ).toEqual([]);
    });

    it("cancelar devolve falso", async () => {
      credentials.get.mockRejectedValue(new Error("NotAllowedError"));

      expect(await verifyBiometrics("Desbloqueie")).toBe(false);
    });

    it("fora de contexto seguro devolve falso sem chamar nada", async () => {
      (globalThis as any).window.isSecureContext = false;

      expect(await verifyBiometrics("Desbloqueie")).toBe(false);
      expect(credentials.get).not.toHaveBeenCalled();
    });
  });

  it("esquecer apaga a credencial deste navegador", () => {
    guardado["@economize_webauthn_credential"] = "AQIDBA";

    forgetBiometrics();

    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      "@economize_webauthn_credential",
    );
  });
});
