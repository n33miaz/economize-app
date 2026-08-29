import React from "react";
import { act, render, fireEvent, waitFor } from "@testing-library/react-native";
import * as LocalAuthentication from "expo-local-authentication";

import Login from "../Login";
import api from "../../../services/api";
import { useAuthStore } from "../../../store/authStore";
import { usePreferencesStore } from "../../../store/preferencesStore";
import { useConfirmStore } from "../../../store/confirmStore";
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

function renderLogin() {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  const utils = render(<Login navigation={navigation} />);
  return { navigation, ...utils };
}

async function submitValidCredentials(getByLabelText: any) {
  fireEvent.changeText(getByLabelText("E-mail"), "usuario@teste.com");
  fireEvent.changeText(getByLabelText("Senha"), "senha-valida-1");
  fireEvent.press(getByLabelText("Entrar"));
}

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
    useConfirmStore.setState({ request: null });
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
      expect(useConfirmStore.getState().request).not.toBeNull();
    });
    // A navegação (troca de árvore por token) só depois da resposta
    expect(useAuthStore.getState().token).toBeNull();
    expect(useConfirmStore.getState().request?.confirmLabel).toBe(
      "Usar biometria",
    );
  });

  it("'Usar biometria' autentica na hora, liga a preferência e entra", async () => {
    mockedAuth.hasHardwareAsync.mockResolvedValue(true);
    mockedAuth.isEnrolledAsync.mockResolvedValue(true);
    mockedAuth.authenticateAsync.mockResolvedValue({ success: true } as any);

    const { getByLabelText } = renderLogin();
    await submitValidCredentials(getByLabelText);
    await waitFor(() => {
      expect(useConfirmStore.getState().request).not.toBeNull();
    });

    await act(async () => {
      await useConfirmStore.getState().request!.onConfirm();
    });

    expect(mockedAuth.authenticateAsync).toHaveBeenCalled();
    expect(usePreferencesStore.getState().biometricLogin).toBe(true);
    expect(usePreferencesStore.getState().biometricChoiceMade).toBe(true);
    expect(useAuthStore.getState().token).toBe("tok-abc");
    expect(useAuthStore.getState().userName).toBe("Usuário Teste");
  });

  it("'Agora não' desliga a preferência, lembra a escolha e entra", async () => {
    mockedAuth.hasHardwareAsync.mockResolvedValue(true);
    mockedAuth.isEnrolledAsync.mockResolvedValue(true);

    const { getByLabelText } = renderLogin();
    await submitValidCredentials(getByLabelText);
    await waitFor(() => {
      expect(useConfirmStore.getState().request).not.toBeNull();
    });

    act(() => {
      useConfirmStore.getState().request!.onCancel!();
    });

    expect(usePreferencesStore.getState().biometricLogin).toBe(false);
    expect(usePreferencesStore.getState().biometricChoiceMade).toBe(true);
    expect(useAuthStore.getState().token).toBe("tok-abc");
  });

  it("falha na confirmação biométrica entra sem ligar a preferência", async () => {
    mockedAuth.hasHardwareAsync.mockResolvedValue(true);
    mockedAuth.isEnrolledAsync.mockResolvedValue(true);
    mockedAuth.authenticateAsync.mockResolvedValue({
      success: false,
      error: "user_cancel",
    } as any);

    const { getByLabelText } = renderLogin();
    await submitValidCredentials(getByLabelText);
    await waitFor(() => {
      expect(useConfirmStore.getState().request).not.toBeNull();
    });

    await act(async () => {
      await useConfirmStore.getState().request!.onConfirm();
    });

    expect(usePreferencesStore.getState().biometricLogin).toBe(false);
    expect(usePreferencesStore.getState().biometricChoiceMade).toBe(true);
    expect(useAuthStore.getState().token).toBe("tok-abc");
  });

  it("sem hardware (web) entra direto, sem modal", async () => {
    mockedAuth.hasHardwareAsync.mockResolvedValue(false);

    const { getByLabelText } = renderLogin();
    await submitValidCredentials(getByLabelText);

    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe("tok-abc");
    });
    expect(useConfirmStore.getState().request).toBeNull();
    expect(mockedAuth.authenticateAsync).not.toHaveBeenCalled();
    expect(usePreferencesStore.getState().biometricChoiceMade).toBe(false);
  });

  it("não pergunta de novo quando a escolha já foi feita", async () => {
    usePreferencesStore.getState().setBiometricChoiceMade(true);

    const { getByLabelText } = renderLogin();
    await submitValidCredentials(getByLabelText);

    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe("tok-abc");
    });
    expect(useConfirmStore.getState().request).toBeNull();
    expect(mockedAuth.hasHardwareAsync).not.toHaveBeenCalled();
  });
});
