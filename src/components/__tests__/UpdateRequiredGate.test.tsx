import React from "react";
import { AppState, Linking, Text } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import UpdateRequiredGate from "../UpdateRequiredGate";
import { useVersionStore } from "../../store/versionStore";

import type { VersionInfo } from "../../services/api";

jest.mock("../../services/api", () => ({
  getAppVersion: jest.fn(),
}));

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const APP = "Saldo: R$ 4.312,00";

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <UpdateRequiredGate>
        <Text>{APP}</Text>
      </UpdateRequiredGate>
    </SafeAreaProvider>,
  );

const INFO: VersionInfo = {
  minVersion: "2.3.0",
  latestVersion: "2.3.0",
  downloadUrl: "https://economize-web.onrender.com/baixar",
  storeUrl: null,
  apkUrl: null,
  message: null,
};

/**
 * Versão abaixo da mínima: nada do app antes de atualizar.
 *
 * <p>O que se trava aqui: enquanto o app NÃO SABE, ele libera (a decisão de
 * bloquear é do servidor, nunca da falta de resposta); quando sabe, a única
 * tela é a do download — sem "agora não".
 */
describe("UpdateRequiredGate", () => {
  let openUrl: jest.SpyInstance;
  let check: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    check = jest.fn();
    useVersionStore.setState({
      status: "unknown",
      info: null,
      checkedAt: null,
      refusedByServer: false,
      bannerDismissed: false,
      check,
    } as never);
    openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  });

  afterEach(() => openUrl.mockRestore());

  it("confere a versão ao montar — a resposta de ontem não vale hoje", () => {
    montar();
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("sem saber ainda, libera o app", () => {
    const { getByText } = montar();
    expect(getByText(APP)).toBeTruthy();
  });

  it("versão em dia libera o app", () => {
    useVersionStore.setState({ status: "ok", info: INFO });
    const { getByText } = montar();
    expect(getByText(APP)).toBeTruthy();
  });

  it("versão mais nova disponível NÃO bloqueia — é só aviso", () => {
    useVersionStore.setState({ status: "update-available", info: INFO });
    const { getByText, queryByText } = montar();
    expect(getByText(APP)).toBeTruthy();
    expect(queryByText("Atualize o Economize!")).toBeNull();
  });

  it("abaixo da mínima, o app SOME e a única tela é a do download", () => {
    useVersionStore.setState({ status: "upgrade-required", info: INFO });

    const { getByText, queryByText, getByLabelText } = montar();

    expect(queryByText(APP)).toBeNull();
    expect(getByText("Atualize o Economize!")).toBeTruthy();
    expect(
      getByText(
        "Esta versão não conversa mais com o servidor. Baixe a nova em menos de um minuto.",
      ),
    ).toBeTruthy();
    expect(getByText(/a mínima é 2\.3\.0/)).toBeTruthy();
    expect(getByLabelText("Abrir a página de download")).toBeTruthy();
    // Sem saída: não há "agora não" nem "entrar assim mesmo"
    expect(queryByText(/agora não/i)).toBeNull();
  });

  it("o botão abre o endereço de download que o servidor mandou", () => {
    useVersionStore.setState({ status: "upgrade-required", info: INFO });
    const { getByLabelText } = montar();

    fireEvent.press(getByLabelText("Abrir a página de download"));

    expect(openUrl).toHaveBeenCalledWith("https://economize-web.onrender.com/baixar");
  });

  it("bloqueado sem detalhes (426 sem corpo), ainda leva ao download padrão", () => {
    useVersionStore.setState({ status: "upgrade-required", info: null });
    const { getByLabelText } = montar();

    fireEvent.press(getByLabelText("Abrir a página de download"));

    expect(openUrl).toHaveBeenCalledWith("https://economize-web.onrender.com/baixar");
  });

  it("volta do segundo plano depois de 6 h confere de novo; antes disso, não", () => {
    let handler: ((state: string) => void) | undefined;
    const addListener = jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation(((_: string, fn: (state: string) => void) => {
        handler = fn;
        return { remove: jest.fn() };
      }) as never);
    const now = jest.spyOn(Date, "now");

    montar();
    expect(check).toHaveBeenCalledTimes(1);

    // 10 minutos fora: um dia normal de uso, não vale nova consulta
    now.mockReturnValue(1_000_000);
    handler?.("background");
    now.mockReturnValue(1_000_000 + 10 * 60 * 1000);
    handler?.("active");
    expect(check).toHaveBeenCalledTimes(1);

    // 6 horas fora: a mínima pode ter mudado
    now.mockReturnValue(2_000_000);
    handler?.("background");
    now.mockReturnValue(2_000_000 + 6 * 60 * 60 * 1000);
    handler?.("active");
    expect(check).toHaveBeenCalledTimes(2);

    now.mockRestore();
    addListener.mockRestore();
  });

  it("com o APK publicado, o botão baixa o ARQUIVO e promete isso", () => {
    // Mandar quem ja esta travado para uma pagina que diz "em breve" e a
    // pior saida possivel (EC-233)
    useVersionStore.setState({
      status: "upgrade-required",
      info: { ...INFO, apkUrl: "https://github.com/x/releases/economize-2.3.0.apk" },
    });
    const { getByLabelText } = montar();

    fireEvent.press(getByLabelText("Baixar nova versão"));

    expect(openUrl).toHaveBeenCalledWith(
      "https://github.com/x/releases/economize-2.3.0.apk",
    );
  });

  it("tem 'conferir de novo' — a saida para quando o erro e NOSSO", () => {
    // Com a minima igual a ultima publicada, um APP_LATEST_VERSION errado no
    // servidor tranca toda instalacao. O botao nao burla o gate: pergunta de
    // novo, e se o servidor continuar recusando a tela continua
    useVersionStore.setState({ status: "upgrade-required", info: INFO });
    const { getByLabelText } = montar();

    fireEvent.press(getByLabelText("Conferir de novo"));

    // O servidor continua recusando, entao a tela continua: o botao pergunta,
    // nao burla
    expect(getByLabelText("Abrir a página de download")).toBeTruthy();
  });
});
