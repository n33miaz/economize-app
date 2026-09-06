import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";

import Login from "../Login";
import api from "../../../services/api";
import { useAuthStore } from "../../../store/authStore";
import { usePreferencesStore } from "../../../store/preferencesStore";
import { useToastStore } from "../../../store/toastStore";

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

jest.mock("../../../services/api", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const mockedAuth = LocalAuthentication as jest.Mocked<
  typeof LocalAuthentication
>;
const mockedPost = api.post as jest.Mock;

/** O modal vive dentro do CustomModal, que lê os insets da área segura. */
const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderLogin() {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  const utils = render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Login navigation={navigation} />
    </SafeAreaProvider>,
  );
  return { navigation, ...utils };
}

async function submitValidCredentials(getByLabelText: any) {
  fireEvent.changeText(getByLabelText("E-mail"), "usuario@teste.com");
  fireEvent.changeText(getByLabelText("Senha"), "senha-valida-1");
  fireEvent.press(getByLabelText("Entrar"));
}

/**
 * O padrão de 1 s do `waitFor` não serve aqui: desde a abertura (EC-148) a tela
 * de login agenda 420 ms + 2.600 ms de temporizador e roda a animação do pote,
 * e o laço de rAF mockado do Reanimated concorre com a sondagem. Com a máquina
 * carregada — a suíte cheia roda vários workers — a espera perdia a corrida e
 * o teste falhava sem nada estar quebrado.
 */
const ESPERA = { timeout: 8000 };

/**
 * A oferta de biometria depois das credenciais.
 *
 * <p>A regra que este arquivo trava, e que mudou: recusar é recusar HOJE. Só o
 * check "não perguntar novamente" cala a oferta para sempre — antes qualquer
 * "agora não" a silenciava, e quem mudasse de ideia tinha de descobrir sozinho
 * o caminho no Perfil.
 */
describe("Login — decisão de biometria pós-credenciais", () => {
  // Espionado (e não real): o showToast verdadeiro agenda um setTimeout de 4s
  // que seguraria o worker do Jest vivo depois da suíte
  let showToastSpy: jest.SpyInstance;

  afterEach(() => {
    showToastSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    showToastSpy = jest
      .spyOn(useToastStore.getState(), "showToast")
      .mockImplementation(() => {});
    useAuthStore.setState({
      token: null,
      userName: null,
      isLoading: false,
      error: null,
    });
    usePreferencesStore.getState().reset();
    mockedPost.mockResolvedValue({
      data: { token: "tok-abc", name: "Usuário Teste" },
    });
  });

  it("segura o token e pergunta quando há biometria disponível sem decisão", async () => {
    mockedAuth.hasHardwareAsync.mockResolvedValue(true);
    mockedAuth.isEnrolledAsync.mockResolvedValue(true);

    const { getByLabelText } = renderLogin();
    await submitValidCredentials(getByLabelText);

    await waitFor(() => {
      expect(getByLabelText("Usar biometria")).toBeTruthy();
    }, ESPERA);
    // A navegação (troca de árvore por token) só depois da resposta
    expect(useAuthStore.getState().token).toBeNull();
    expect(getByLabelText("Não perguntar novamente")).toBeTruthy();
  });

  it("'Usar biometria' autentica na hora, liga a preferência e entra", async () => {
    mockedAuth.hasHardwareAsync.mockResolvedValue(true);
    mockedAuth.isEnrolledAsync.mockResolvedValue(true);
    mockedAuth.authenticateAsync.mockResolvedValue({ success: true } as any);

    const { getByLabelText } = renderLogin();
    await submitValidCredentials(getByLabelText);
    await waitFor(() => {
      expect(getByLabelText("Usar biometria")).toBeTruthy();
    }, ESPERA);

    fireEvent.press(getByLabelText("Usar biometria"));

    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe("tok-abc");
    }, ESPERA);
    expect(mockedAuth.authenticateAsync).toHaveBeenCalled();
    expect(usePreferencesStore.getState().biometricLogin).toBe(true);
    expect(usePreferencesStore.getState().biometricChoiceMade).toBe(true);
    expect(useAuthStore.getState().userName).toBe("Usuário Teste");
  });

  it("'Agora não' entra, mas a pergunta VOLTA no próximo login", async () => {
    mockedAuth.hasHardwareAsync.mockResolvedValue(true);
    mockedAuth.isEnrolledAsync.mockResolvedValue(true);

    const { getByLabelText } = renderLogin();
    await submitValidCredentials(getByLabelText);
    await waitFor(() => {
      expect(getByLabelText("Agora não")).toBeTruthy();
    }, ESPERA);

    fireEvent.press(getByLabelText("Agora não"));

    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe("tok-abc");
    }, ESPERA);
    expect(usePreferencesStore.getState().biometricLogin).toBe(false);
    // Sem o check, a decisão NÃO é definitiva — é a diferença que o modal
    // com caixa de seleção existe para dar
    expect(usePreferencesStore.getState().biometricChoiceMade).toBe(false);
  });

  it("com o check marcado, 'Agora não' cala a pergunta para sempre", async () => {
    mockedAuth.hasHardwareAsync.mockResolvedValue(true);
    mockedAuth.isEnrolledAsync.mockResolvedValue(true);

    const { getByLabelText } = renderLogin();
    await submitValidCredentials(getByLabelText);
    await waitFor(() => {
      expect(getByLabelText("Não perguntar novamente")).toBeTruthy();
    }, ESPERA);

    fireEvent.press(getByLabelText("Não perguntar novamente"));
    fireEvent.press(getByLabelText("Agora não"));

    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe("tok-abc");
    }, ESPERA);
    expect(usePreferencesStore.getState().biometricLogin).toBe(false);
    expect(usePreferencesStore.getState().biometricChoiceMade).toBe(true);
  });

  it("falha na confirmação biométrica mantém o modal aberto, sem entrar", async () => {
    mockedAuth.hasHardwareAsync.mockResolvedValue(true);
    mockedAuth.isEnrolledAsync.mockResolvedValue(true);
    mockedAuth.authenticateAsync.mockResolvedValue({
      success: false,
      error: "user_cancel",
    } as any);

    const { getByLabelText } = renderLogin();
    await submitValidCredentials(getByLabelText);
    await waitFor(() => {
      expect(getByLabelText("Usar biometria")).toBeTruthy();
    }, ESPERA);

    fireEvent.press(getByLabelText("Usar biometria"));

    await waitFor(() => {
      expect(showToastSpy).toHaveBeenCalled();
    }, ESPERA);
    // Cancelar o prompt do sistema é engano comum: fechar tudo obrigaria a
    // refazer o login inteiro para tentar de novo
    expect(usePreferencesStore.getState().biometricLogin).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
    expect(getByLabelText("Agora não")).toBeTruthy();
  });

  it("sem hardware entra direto, sem modal", async () => {
    mockedAuth.hasHardwareAsync.mockResolvedValue(false);

    const { getByLabelText, queryByLabelText } = renderLogin();
    await submitValidCredentials(getByLabelText);

    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe("tok-abc");
    }, ESPERA);
    expect(queryByLabelText("Usar biometria")).toBeNull();
    expect(mockedAuth.authenticateAsync).not.toHaveBeenCalled();
    expect(usePreferencesStore.getState().biometricChoiceMade).toBe(false);
  });

  it("não pergunta de novo quando a escolha já foi feita", async () => {
    usePreferencesStore.getState().setBiometricChoiceMade(true);

    const { getByLabelText, queryByLabelText } = renderLogin();
    await submitValidCredentials(getByLabelText);

    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe("tok-abc");
    }, ESPERA);
    expect(queryByLabelText("Usar biometria")).toBeNull();
    expect(mockedAuth.hasHardwareAsync).not.toHaveBeenCalled();
  });
});
