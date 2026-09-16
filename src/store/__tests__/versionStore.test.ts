import { getAppVersion } from "../../services/api";
import { decideVersionStatus, useVersionStore } from "../versionStore";

import type { VersionInfo } from "../../services/api";

jest.mock("../../services/api", () => ({
  getAppVersion: jest.fn(),
}));

// A versão local é fixada para os testes não dependerem do app.json
jest.mock("../../utils/appVersion", () => ({
  ...jest.requireActual("../../utils/appVersion"),
  APP_VERSION: "2.2.0",
}));

const mockGet = getAppVersion as jest.MockedFunction<typeof getAppVersion>;

const info = (over: Partial<VersionInfo> = {}): VersionInfo => ({
  minVersion: "2.0.0",
  latestVersion: "2.2.0",
  downloadUrl: "https://economize-web.onrender.com/baixar",
  storeUrl: null,
  apkUrl: null,
  message: null,
  ...over,
});

const limpar = () =>
  useVersionStore.setState({
    status: "unknown",
    info: null,
    checkedAt: null,
    refusedByServer: false,
    bannerDismissed: false,
  });

/**
 * Versão do app × o que o servidor aceita.
 *
 * <p>O que estes testes travam, acima de tudo: o app NUNCA bloqueia por não
 * conseguir checar. Bloquear é decisão positiva do servidor (mínima maior que
 * a nossa, ou um 426) — falha de rede mantém o que já se sabia.
 */
describe("decideVersionStatus", () => {
  it("nativo abaixo da mínima é bloqueio", () => {
    expect(
      decideVersionStatus("2.2.0", { minVersion: "2.3.0", latestVersion: "2.3.0" }, "android"),
    ).toBe("upgrade-required");
  });

  it("nativo acima da mínima e abaixo da última é só aviso", () => {
    expect(
      decideVersionStatus("2.2.0", { minVersion: "2.0.0", latestVersion: "2.3.0" }, "ios"),
    ).toBe("update-available");
  });

  it("na última versão (ou além) está tudo bem", () => {
    expect(
      decideVersionStatus("2.3.0", { minVersion: "2.0.0", latestVersion: "2.3.0" }, "android"),
    ).toBe("ok");
    expect(
      decideVersionStatus("2.4.0", { minVersion: "2.0.0", latestVersion: "2.3.0" }, "android"),
    ).toBe("ok");
  });

  it("web NUNCA bloqueia — abaixo da mínima vira aviso de recarregar", () => {
    // Não há o que baixar no navegador: o bundle novo vem no reload
    expect(
      decideVersionStatus("2.2.0", { minVersion: "2.3.0", latestVersion: "2.3.0" }, "web"),
    ).toBe("update-available");
  });

  it("web em cache velho, acima da mínima, também é avisada", () => {
    expect(
      decideVersionStatus("2.2.0", { minVersion: "2.0.0", latestVersion: "2.3.0" }, "web"),
    ).toBe("update-available");
  });

  it("versão local desconhecida não bloqueia nem avisa", () => {
    // É bug de build; bloquear todo mundo por causa dele seria o pior dos
    // dois erros — e se o servidor recusar, o 426 chega de qualquer jeito
    expect(
      decideVersionStatus("0.0.0", { minVersion: "2.3.0", latestVersion: "2.3.0" }, "android"),
    ).toBe("ok");
  });
});

describe("versionStore.check", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    limpar();
  });

  it("nasce sem saber, e sem saber não bloqueia", () => {
    expect(useVersionStore.getState().status).toBe("unknown");
  });

  it("guarda a resposta e decide (aqui: iOS abaixo da mínima)", async () => {
    mockGet.mockResolvedValue(info({ minVersion: "2.3.0", latestVersion: "2.3.0" }));

    await useVersionStore.getState().check();

    const state = useVersionStore.getState();
    expect(state.status).toBe("upgrade-required");
    expect(state.info?.minVersion).toBe("2.3.0");
    expect(state.checkedAt).not.toBeNull();
  });

  it("abaixo só da última vira aviso, não bloqueio", async () => {
    mockGet.mockResolvedValue(info({ minVersion: "2.0.0", latestVersion: "2.3.0" }));

    await useVersionStore.getState().check();

    expect(useVersionStore.getState().status).toBe("update-available");
  });

  it("falha de rede mantém o estado anterior — nunca bloqueia por não checar", async () => {
    mockGet.mockResolvedValue(info());
    await useVersionStore.getState().check();
    expect(useVersionStore.getState().status).toBe("ok");

    mockGet.mockRejectedValue(new Error("offline"));
    await useVersionStore.getState().check();

    expect(useVersionStore.getState().status).toBe("ok");
    expect(useVersionStore.getState().info).toEqual(info());
  });

  it("falha na primeira checagem deixa em 'unknown', que libera", async () => {
    mockGet.mockRejectedValue(new Error("timeout"));

    await useVersionStore.getState().check();

    expect(useVersionStore.getState().status).toBe("unknown");
  });
});

describe("versionStore.markUpgradeRequired — o 426", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    limpar();
    mockGet.mockRejectedValue(new Error("offline"));
  });

  it("bloqueia na hora com o que o ProblemDetail traz", () => {
    useVersionStore.getState().markUpgradeRequired({
      type: "https://economize.app/problems/upgrade-required",
      title: "Atualize o app",
      detail: "Esta versão não é mais aceita.",
      minVersion: "2.3.0",
      downloadUrl: "https://economize-web.onrender.com/baixar",
    });

    const state = useVersionStore.getState();
    expect(state.status).toBe("upgrade-required");
    expect(state.info?.minVersion).toBe("2.3.0");
    expect(state.info?.downloadUrl).toBe("https://economize-web.onrender.com/baixar");
    expect(state.info?.message).toBe("Esta versão não é mais aceita.");
    expect(state.refusedByServer).toBe(true);
  });

  it("sem corpo nenhum, ainda bloqueia e aponta para o download padrão", () => {
    useVersionStore.getState().markUpgradeRequired(undefined);

    const state = useVersionStore.getState();
    expect(state.status).toBe("upgrade-required");
    expect(state.info?.downloadUrl).toBe("https://economize-web.onrender.com/baixar");
  });

  it("dispara a consulta completa logo depois — para ter a última versão e o APK", () => {
    useVersionStore.getState().markUpgradeRequired({ minVersion: "2.3.0" });

    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("depois de um 426 a consulta não REBAIXA o bloqueio", async () => {
    // Servidor que recusa e ao mesmo tempo diz "tudo bem" faria o gate
    // piscar; o que vale é a recusa, até o app ser atualizado
    useVersionStore.getState().markUpgradeRequired({ minVersion: "2.3.0" });
    mockGet.mockResolvedValue(info({ minVersion: "2.0.0", latestVersion: "2.2.0" }));

    await useVersionStore.getState().check();

    expect(useVersionStore.getState().status).toBe("upgrade-required");
    // …mas a informação nova (APK, última versão) é aproveitada
    expect(useVersionStore.getState().info?.latestVersion).toBe("2.2.0");
  });
});

/**
 * As notas da versão passam pela loja sem tratamento: a folha de anúncio lê
 * `info.notes` e é ela quem decide o que fazer com a lista. O que a loja
 * garante é não PERDER a lista no caminho — nem na consulta, nem no 426.
 */
describe("versionStore — notas da versão", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    limpar();
  });

  it("repassa as notas que a consulta trouxe, na ordem", async () => {
    mockGet.mockResolvedValue(
      info({
        latestVersion: "2.3.0",
        notes: ["Mercado com mais moedas", "Home com parcelamentos"],
      }),
    );

    await useVersionStore.getState().check();

    expect(useVersionStore.getState().info?.notes).toEqual([
      "Mercado com mais moedas",
      "Home com parcelamentos",
    ]);
  });

  it("servidor anterior ao campo deixa as notas indefinidas — e nada quebra", async () => {
    mockGet.mockResolvedValue(info({ latestVersion: "2.3.0" }));

    await useVersionStore.getState().check();

    expect(useVersionStore.getState().status).toBe("update-available");
    expect(useVersionStore.getState().info?.notes).toBeUndefined();
  });

  it("o 426 não apaga as notas que já se tinha", async () => {
    mockGet.mockResolvedValue(info({ latestVersion: "2.3.0", notes: ["Extrato mais leve"] }));
    await useVersionStore.getState().check();
    mockGet.mockRejectedValue(new Error("offline"));

    useVersionStore.getState().markUpgradeRequired({ minVersion: "2.3.0" });

    expect(useVersionStore.getState().info?.notes).toEqual(["Extrato mais leve"]);
  });
});

describe("faixa da web", () => {
  beforeEach(limpar);

  it("fechar a faixa vale para a sessão", () => {
    expect(useVersionStore.getState().bannerDismissed).toBe(false);
    useVersionStore.getState().dismissBanner();
    expect(useVersionStore.getState().bannerDismissed).toBe(true);
  });
});
