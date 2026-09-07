import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import Security from "../Security";
import * as api from "../../services/api";
import { useConfirmStore } from "../../store/confirmStore";
import { useToastStore } from "../../store/toastStore";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  getMfaStatus: jest.fn(),
  startMfaSetup: jest.fn(),
  activateMfa: jest.fn(),
  rotateMfaRecoveryCodes: jest.fn(),
  disableMfa: jest.fn(),
}));

// O PageContainer e o ScreenHeader consultam a navegação; sem estas portas o
// componente estoura antes de qualquer asserção
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    // O ScreenHeader lê o estado da pilha para decidir se desenha a seta
    getState: () => ({ index: 1, routes: [{ name: "Profile" }, { name: "Segurança" }] }),
  }),
  useRoute: () => ({ params: {} }),
  useIsFocused: () => true,
  useFocusEffect: (efeito: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(efeito, []);
  },
}));

const mocked = api as jest.Mocked<typeof api>;

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Security />
    </SafeAreaProvider>,
  );

const DESLIGADO = {
  enabled: false,
  pendingConfirmation: false,
  confirmedAt: null,
  recoveryCodesRemaining: 0,
};

const LIGADO = {
  enabled: true,
  pendingConfirmation: false,
  confirmedAt: "2026-09-05T12:00:00Z",
  recoveryCodesRemaining: 10,
};

/**
 * A tela de verificação em duas etapas.
 *
 * <p>O que ela precisa acertar, acima de tudo, é a SEPARAÇÃO entre "cadastro
 * começado" e "fator ativo". Confundir os dois é o jeito de trancar o dono
 * para fora da própria conta: o login passaria a exigir um código que o
 * aparelho dele nunca gerou.
 */
describe("Security", () => {
  let showToastSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    showToastSpy = jest
      .spyOn(useToastStore.getState(), "showToast")
      .mockImplementation(() => {});
    useConfirmStore.setState({ request: null });
  });

  afterEach(() => showToastSpy.mockRestore());

  it("desligada, oferece ativar e diz o que protege a conta hoje", async () => {
    mocked.getMfaStatus.mockResolvedValue(DESLIGADO);

    const { getByLabelText, getByText } = montar();

    await waitFor(() => expect(getByText("Desligada")).toBeTruthy());
    expect(getByText("Só a senha protege sua conta hoje.")).toBeTruthy();
    expect(getByLabelText("Ativar verificação em duas etapas")).toBeTruthy();
  });

  it("ativar mostra a chave para cadastrar, e ainda NÃO liga o fator", async () => {
    mocked.getMfaStatus.mockResolvedValue(DESLIGADO);
    mocked.startMfaSetup.mockResolvedValue({
      secret: "JBSWY3DPEHPK3PXP",
      otpauthUri: "otpauth://totp/Economize%21:ana%40x.com?secret=JBSWY3DPEHPK3PXP",
    });

    const { getByLabelText, getByText } = montar();
    await waitFor(() => expect(getByText("Desligada")).toBeTruthy());

    fireEvent.press(getByLabelText("Ativar verificação em duas etapas"));

    await waitFor(() => expect(getByText("JBSWY3DPEHPK3PXP")).toBeTruthy());
    // o cartão de estado continua dizendo "Desligada": o fator só passa a
    // valer quando um código conferir
    expect(getByText("Desligada")).toBeTruthy();
    expect(getByLabelText("Código de 6 dígitos")).toBeTruthy();
  });

  it("o botão de confirmar só libera com os 6 dígitos", async () => {
    mocked.getMfaStatus.mockResolvedValue(DESLIGADO);
    mocked.startMfaSetup.mockResolvedValue({
      secret: "JBSWY3DPEHPK3PXP",
      otpauthUri: "otpauth://totp/x",
    });

    const { getByLabelText, getByText } = montar();
    await waitFor(() => expect(getByText("Desligada")).toBeTruthy());
    fireEvent.press(getByLabelText("Ativar verificação em duas etapas"));
    await waitFor(() => expect(getByLabelText("Código de 6 dígitos")).toBeTruthy());

    fireEvent.changeText(getByLabelText("Código de 6 dígitos"), "123");
    fireEvent.press(getByLabelText("Confirmar e ativar"));

    expect(mocked.activateMfa).not.toHaveBeenCalled();
  });

  it("confirmar ativa e mostra os códigos de recuperação uma única vez", async () => {
    mocked.getMfaStatus
      .mockResolvedValueOnce(DESLIGADO)
      .mockResolvedValue(LIGADO);
    mocked.startMfaSetup.mockResolvedValue({
      secret: "JBSWY3DPEHPK3PXP",
      otpauthUri: "otpauth://totp/x",
    });
    mocked.activateMfa.mockResolvedValue(["AAAA111111", "BBBB222222"]);

    const { getByLabelText, getByText } = montar();
    await waitFor(() => expect(getByText("Desligada")).toBeTruthy());
    fireEvent.press(getByLabelText("Ativar verificação em duas etapas"));
    await waitFor(() => expect(getByLabelText("Código de 6 dígitos")).toBeTruthy());

    fireEvent.changeText(getByLabelText("Código de 6 dígitos"), "123456");
    fireEvent.press(getByLabelText("Confirmar e ativar"));

    await waitFor(() => expect(getByText("AAAA111111")).toBeTruthy());
    expect(mocked.activateMfa).toHaveBeenCalledWith("123456");
    expect(getByText("Ativada")).toBeTruthy();
    expect(getByText("BBBB222222")).toBeTruthy();
  });

  it("código errado avisa e mantém o cadastro aberto", async () => {
    mocked.getMfaStatus.mockResolvedValue(DESLIGADO);
    mocked.startMfaSetup.mockResolvedValue({
      secret: "JBSWY3DPEHPK3PXP",
      otpauthUri: "otpauth://totp/x",
    });
    mocked.activateMfa.mockRejectedValue(new Error("400"));

    const { getByLabelText, getByText } = montar();
    await waitFor(() => expect(getByText("Desligada")).toBeTruthy());
    fireEvent.press(getByLabelText("Ativar verificação em duas etapas"));
    await waitFor(() => expect(getByLabelText("Código de 6 dígitos")).toBeTruthy());

    fireEvent.changeText(getByLabelText("Código de 6 dígitos"), "000000");
    fireEvent.press(getByLabelText("Confirmar e ativar"));

    await waitFor(() =>
      expect(showToastSpy).toHaveBeenCalledWith(
        expect.stringContaining("Código inválido"),
        "error",
      ),
    );
    // refazer o cadastro do zero por um dígito errado seria cruel
    expect(getByLabelText("Código de 6 dígitos")).toBeTruthy();
  });

  it("ligada, mostra quantos códigos restam e o caminho para desligar", async () => {
    mocked.getMfaStatus.mockResolvedValue(LIGADO);

    const { getByLabelText, getByText } = montar();

    await waitFor(() => expect(getByText("Ativada")).toBeTruthy());
    expect(getByText("Restam 10 códigos de recuperação.")).toBeTruthy();
    expect(getByLabelText("Desligar verificação em duas etapas")).toBeTruthy();
  });

  it("desligar sem senha nem abre a confirmação", async () => {
    mocked.getMfaStatus.mockResolvedValue(LIGADO);

    const { getByLabelText, getByText } = montar();
    await waitFor(() => expect(getByText("Ativada")).toBeTruthy());

    fireEvent.press(getByLabelText("Desligar verificação em duas etapas"));

    expect(useConfirmStore.getState().request).toBeNull();
    expect(mocked.disableMfa).not.toHaveBeenCalled();
  });

  it("desligar com senha pede confirmação antes de chamar o servidor", async () => {
    mocked.getMfaStatus
      .mockResolvedValueOnce(LIGADO)
      .mockResolvedValue(DESLIGADO);
    mocked.disableMfa.mockResolvedValue(undefined);

    const { getByLabelText, getByText } = montar();
    await waitFor(() => expect(getByText("Ativada")).toBeTruthy());

    fireEvent.changeText(getByLabelText("Sua senha"), "senha-da-ana");
    fireEvent.press(getByLabelText("Desligar verificação em duas etapas"));

    // Desarmar a proteção é destrutivo: nunca em um toque só
    expect(useConfirmStore.getState().request).not.toBeNull();
    expect(mocked.disableMfa).not.toHaveBeenCalled();

    await useConfirmStore.getState().request!.onConfirm();

    expect(mocked.disableMfa).toHaveBeenCalledWith("senha-da-ana");
    await waitFor(() => expect(getByText("Desligada")).toBeTruthy());
  });

  it("gerar novos códigos substitui o lote na tela", async () => {
    mocked.getMfaStatus.mockResolvedValue(LIGADO);
    mocked.rotateMfaRecoveryCodes.mockResolvedValue(["ZZZZ999999"]);

    const { getByLabelText, getByText } = montar();
    await waitFor(() => expect(getByText("Ativada")).toBeTruthy());

    fireEvent.press(getByLabelText("Gerar novos códigos de recuperação"));

    await waitFor(() => expect(getByText("ZZZZ999999")).toBeTruthy());
  });

  it("servidor fora do ar mostra o estado de erro, com repetir", async () => {
    mocked.getMfaStatus.mockRejectedValueOnce(new Error("offline"));
    mocked.getMfaStatus.mockResolvedValue(DESLIGADO);

    const { getByLabelText, getByText } = montar();

    await waitFor(() =>
      expect(
        getByText("Não conseguimos ler o estado da sua segurança."),
      ).toBeTruthy(),
    );

    fireEvent.press(getByLabelText("Tentar de novo"));

    await waitFor(() => expect(getByText("Desligada")).toBeTruthy());
  });
});
