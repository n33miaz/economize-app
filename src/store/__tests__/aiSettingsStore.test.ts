import type {
  AiKeyTestResult,
  AiProviderCatalog,
  AiSettings,
} from "../../services/api";
import { hasOwnKey, keyIsUnreadable, useAiSettingsStore } from "../aiSettingsStore";

// A rede é o limite. `getApiErrorStatus` entra com a leitura do original
// porque é dela que saem as mensagens específicas de 503 e 400.
jest.mock("../../services/api", () => ({
  getAiProviders: jest.fn(),
  getAiSettings: jest.fn(),
  saveAiSettings: jest.fn(),
  deleteAiSettings: jest.fn(),
  testAiKey: jest.fn(),
  getApiErrorStatus: (error: any) => error?.response?.status ?? null,
}));

const api = jest.requireMock("../../services/api");

const catalogo: AiProviderCatalog = {
  byokAvailable: true,
  providers: [
    {
      id: "OPENROUTER",
      label: "OpenRouter",
      defaultModel: "openai/gpt-4o-mini",
      models: ["openai/gpt-4o-mini", "anthropic/claude-sonnet-5"],
      apiKeyUrl: "https://openrouter.ai/settings/keys",
    },
  ],
};

function settings(overrides: Partial<AiSettings> = {}): AiSettings {
  return {
    source: "SERVER",
    provider: "GEMINI",
    model: "gemini-2.0-flash",
    keyLast4: null,
    keyStatus: "SERVER_KEY",
    byokAvailable: true,
    updatedAt: null,
    ...overrides,
  };
}

const erro = (status: number) => ({ response: { status } });

beforeEach(() => {
  jest.clearAllMocks();
  useAiSettingsStore.getState().reset();
});

describe("load", () => {
  it("traz catálogo e configuração na mesma abertura", async () => {
    api.getAiProviders.mockResolvedValue(catalogo);
    api.getAiSettings.mockResolvedValue(settings());

    await useAiSettingsStore.getState().load();

    const s = useAiSettingsStore.getState();
    expect(s.catalog).toEqual(catalogo);
    expect(s.settings?.source).toBe("SERVER");
    expect(s.hasLoadedOnce).toBe(true);
    expect(s.error).toBeNull();
  });

  it("falha NÃO marca hasLoadedOnce — senão a tela trava no erro", async () => {
    api.getAiProviders.mockRejectedValue(erro(500));
    api.getAiSettings.mockResolvedValue(settings());

    await useAiSettingsStore.getState().load();

    const s = useAiSettingsStore.getState();
    expect(s.hasLoadedOnce).toBe(false);
    expect(s.error).toBeTruthy();
    expect(s.isLoading).toBe(false);
  });

  it("503 diz que a instalação não aceita, e não 'tente de novo'", async () => {
    // Repetir não resolveria: falta chave-mestra no servidor
    api.getAiProviders.mockRejectedValue(erro(503));
    api.getAiSettings.mockRejectedValue(erro(503));

    await useAiSettingsStore.getState().load();

    expect(useAiSettingsStore.getState().error).toContain("não aceita chave própria");
  });
});

describe("test", () => {
  it("chave recusada volta como RESULTADO, não como erro", async () => {
    // A API responde 200 com ok:false. Tratar como exceção esconderia a
    // mensagem que diz o motivo
    const recusada: AiKeyTestResult = {
      ok: false,
      provider: "OPENROUTER",
      model: "openai/gpt-4o-mini",
      reason: "AUTH",
      message: "O provedor recusou a chave.",
      latencyMs: 320,
    };
    api.testAiKey.mockResolvedValue(recusada);

    const out = await useAiSettingsStore.getState().test({ apiKey: "sk-x" });

    expect(out).toEqual(recusada);
    expect(useAiSettingsStore.getState().testResult?.reason).toBe("AUTH");
    expect(useAiSettingsStore.getState().error).toBeNull();
  });

  it("queda de rede vira erro do store, não resultado de teste", async () => {
    api.testAiKey.mockRejectedValue(erro(500));

    const out = await useAiSettingsStore.getState().test({ apiKey: "sk-x" });

    expect(out).toBeNull();
    expect(useAiSettingsStore.getState().testResult).toBeNull();
    expect(useAiSettingsStore.getState().error).toBeTruthy();
  });
});

describe("save e remove", () => {
  it("salvar aproveita a resposta do PUT em vez de reler", async () => {
    const salvo = settings({
      source: "USER",
      provider: "OPENROUTER",
      model: "openai/gpt-4o-mini",
      keyLast4: "a3c6",
      keyStatus: "OK",
    });
    api.saveAiSettings.mockResolvedValue(salvo);

    const ok = await useAiSettingsStore
      .getState()
      .save("OPENROUTER", "openai/gpt-4o-mini", "sk-or-v1-exemplo");

    expect(ok).toBe(true);
    expect(api.getAiSettings).not.toHaveBeenCalled();
    expect(useAiSettingsStore.getState().settings?.keyLast4).toBe("a3c6");
  });

  it("modelo fora da lista devolve texto próprio do 400", async () => {
    api.saveAiSettings.mockRejectedValue(erro(400));

    const ok = await useAiSettingsStore
      .getState()
      .save("OPENROUTER", "modelo-que-nao-existe", "sk-x");

    expect(ok).toBe(false);
    expect(useAiSettingsStore.getState().error).toContain("não aceito");
  });

  it("remover relê, porque o DELETE responde sem corpo", async () => {
    // É a releitura que traz o provedor do servidor que assume a partir dali
    api.deleteAiSettings.mockResolvedValue(undefined);
    api.getAiSettings.mockResolvedValue(settings());

    const ok = await useAiSettingsStore.getState().remove();

    expect(ok).toBe(true);
    expect(api.getAiSettings).toHaveBeenCalledTimes(1);
    expect(useAiSettingsStore.getState().settings?.source).toBe("SERVER");
  });

  it("salvar limpa o resultado do teste anterior", async () => {
    // O teste era de outra chave; deixá-lo na tela diria "válida" sobre algo
    // que não é mais o que está gravado
    useAiSettingsStore.setState({
      testResult: {
        ok: true,
        provider: "OPENROUTER",
        model: "openai/gpt-4o-mini",
        reason: null,
        message: "Chave aceita.",
        latencyMs: 100,
      },
    });
    api.saveAiSettings.mockResolvedValue(settings({ source: "USER" }));

    await useAiSettingsStore.getState().save("OPENROUTER", "openai/gpt-4o-mini", "sk-x");

    expect(useAiSettingsStore.getState().testResult).toBeNull();
  });
});

describe("leitura de estado", () => {
  it("distingue chave própria de chave do servidor", () => {
    expect(hasOwnKey(settings({ source: "USER" }))).toBe(true);
    expect(hasOwnKey(settings())).toBe(false);
    expect(hasOwnKey(null)).toBe(false);
  });

  it("reconhece a chave que a chave-mestra atual não abre mais", () => {
    expect(keyIsUnreadable(settings({ keyStatus: "UNREADABLE" }))).toBe(true);
    expect(keyIsUnreadable(settings())).toBe(false);
  });
});
