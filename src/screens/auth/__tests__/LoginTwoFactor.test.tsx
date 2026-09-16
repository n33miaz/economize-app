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
  hasHardwareAsync: jest.fn().mockResolvedValue(false),
  isEnrolledAsync: jest.fn().mockResolvedValue(false),
  authenticateAsync: jest.fn(),
}));

jest.mock("../../../services/api", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const mockedPost = api.post as jest.Mock;
const mockedAuth = LocalAuthentication as jest.Mocked<
  typeof LocalAuthentication
>;

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const ESPERA = { timeout: 8000 };

function renderLogin() {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  const utils = render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Login navigation={navigation} />
    </SafeAreaProvider>,
  );
  return { navigation, ...utils };
}

/**
 * A abertura (EC-148) agora segura TODO o formulário, e não só o nome da
 * marca: pedido do dono em 15/09/2026 — "ao abrir o app, nenhum campo e nada
 * deve aparecer além do pote e a animação dele". Antes os campos existiam no
 * primeiro quadro e o teste podia digitar de imediato; agora ele espera o
 * mesmo que uma pessoa espera.
 */
async function esperarFormulario(getByLabelText: any) {
  await waitFor(() => expect(getByLabelText("E-mail")).toBeTruthy(), ESPERA);
}

async function submitCredentials(getByLabelText: any) {
  await esperarFormulario(getByLabelText);
  fireEvent.changeText(getByLabelText("E-mail"), "ana@teste.com");
  fireEvent.changeText(getByLabelText("Senha"), "senha-da-ana");
  fireEvent.press(getByLabelText("Entrar"));
}

/**
 * O segundo passo do login na tela.
 *
 * <p>A regra dura é a mesma do servidor: com o fator ativo, a senha certa NÃO
 * entra em lugar nenhum. Enquanto o código não confere, o token não existe — e
 * é isso que o primeiro teste prova, porque um bug aqui (guardar a sessão
 * "adiantado") tornaria o segundo fator decorativo mesmo com o servidor certo.
 */
describe("Login — verificação em duas etapas", () => {
  let showToastSpy: jest.SpyInstance;

  afterEach(() => {
    showToastSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuth.hasHardwareAsync.mockResolvedValue(false);
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
  });

  it("com o fator ativo, a senha certa pede o código e NÃO abre sessão", async () => {
    mockedPost.mockResolvedValue({
      data: { mfaRequired: true, mfaToken: "desafio-123" },
    });

    const { getByLabelText, queryByLabelText } = renderLogin();
    await submitCredentials(getByLabelText);

    await waitFor(() => {
      expect(getByLabelText("Código de verificação")).toBeTruthy();
    }, ESPERA);
    expect(useAuthStore.getState().token).toBeNull();
    // o formulário de senha sai de cena: são dois passos, não dois campos
    expect(queryByLabelText("Senha")).toBeNull();
  });

  it("o código certo troca o desafio pela sessão", async () => {
    mockedPost
      .mockResolvedValueOnce({
        data: { mfaRequired: true, mfaToken: "desafio-123" },
      })
      .mockResolvedValueOnce({
        data: { token: "tok-abc", name: "Ana" },
      });

    const { getByLabelText } = renderLogin();
    await submitCredentials(getByLabelText);
    await waitFor(() => {
      expect(getByLabelText("Código de verificação")).toBeTruthy();
    }, ESPERA);

    fireEvent.changeText(getByLabelText("Código de verificação"), "123456");
    fireEvent.press(getByLabelText("Verificar código"));

    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe("tok-abc");
    }, ESPERA);
    // O aparelho é lembrado no mesmo passo: é o segundo fator que autoriza
    // dispensá-lo nas próximas vezes
    expect(mockedPost).toHaveBeenLastCalledWith("/auth/login/mfa", {
      mfaToken: "desafio-123",
      code: "123456",
      rememberDevice: true,
      deviceLabel: expect.any(String),
    });
    expect(useAuthStore.getState().userName).toBe("Ana");
  });

  it("código errado mostra o erro e mantém o passo aberto", async () => {
    mockedPost
      .mockResolvedValueOnce({
        data: { mfaRequired: true, mfaToken: "desafio-123" },
      })
      .mockRejectedValueOnce({ response: { status: 401 } });

    const { getByLabelText, getByText } = renderLogin();
    await submitCredentials(getByLabelText);
    await waitFor(() => {
      expect(getByLabelText("Código de verificação")).toBeTruthy();
    }, ESPERA);

    fireEvent.changeText(getByLabelText("Código de verificação"), "000000");
    fireEvent.press(getByLabelText("Verificar código"));

    await waitFor(() => {
      expect(getByText("Código inválido ou expirado. Tente de novo.")).toBeTruthy();
    }, ESPERA);
    expect(useAuthStore.getState().token).toBeNull();
    expect(getByLabelText("Código de verificação")).toBeTruthy();
  });

  it("um código de recuperação (com letras) também é enviado", async () => {
    mockedPost
      .mockResolvedValueOnce({
        data: { mfaRequired: true, mfaToken: "desafio-123" },
      })
      .mockResolvedValueOnce({ data: { token: "tok-abc", name: "Ana" } });

    const { getByLabelText } = renderLogin();
    await submitCredentials(getByLabelText);
    await waitFor(() => {
      expect(getByLabelText("Código de verificação")).toBeTruthy();
    }, ESPERA);

    // teclado numérico travaria justamente a saída de quem perdeu o aparelho
    fireEvent.changeText(getByLabelText("Código de verificação"), "K7QX2M9BTZ");
    fireEvent.press(getByLabelText("Verificar código"));

    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe("tok-abc");
    }, ESPERA);
    expect(mockedPost).toHaveBeenLastCalledWith("/auth/login/mfa", {
      mfaToken: "desafio-123",
      code: "K7QX2M9BTZ",
      rememberDevice: true,
      deviceLabel: expect.any(String),
    });
  });

  it("código curto demais não vira requisição", async () => {
    mockedPost.mockResolvedValueOnce({
      data: { mfaRequired: true, mfaToken: "desafio-123" },
    });

    const { getByLabelText } = renderLogin();
    await submitCredentials(getByLabelText);
    await waitFor(() => {
      expect(getByLabelText("Código de verificação")).toBeTruthy();
    }, ESPERA);
    mockedPost.mockClear();

    fireEvent.changeText(getByLabelText("Código de verificação"), "123");
    fireEvent.press(getByLabelText("Verificar código"));

    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("'usar outra conta' volta ao formulário de senha", async () => {
    mockedPost.mockResolvedValueOnce({
      data: { mfaRequired: true, mfaToken: "desafio-123" },
    });

    const { getByLabelText } = renderLogin();
    await submitCredentials(getByLabelText);
    await waitFor(() => {
      expect(getByLabelText("Voltar para o login")).toBeTruthy();
    }, ESPERA);

    fireEvent.press(getByLabelText("Voltar para o login"));

    expect(getByLabelText("Senha")).toBeTruthy();
  });

  it("o login leva o segredo do aparelho, quando ele existe", async () => {
    mockedPost.mockResolvedValue({ data: { token: "tok-abc", name: "Ana" } });

    const { getByLabelText } = renderLogin();
    await submitCredentials(getByLabelText);

    await waitFor(() => expect(useAuthStore.getState().token).toBe("tok-abc"));
    // Sem isto, o código seria pedido dez vezes por dia no celular do dono
    expect(mockedPost).toHaveBeenCalledWith("/auth/login", {
      email: "ana@teste.com",
      password: "senha-da-ana",
      deviceToken: null,
      deviceLabel: expect.any(String),
    });
  });

  it("sem fator ativo, a resposta de sempre continua entrando direto", async () => {
    mockedPost.mockResolvedValue({
      data: { token: "tok-abc", name: "Ana" },
    });

    const { getByLabelText, queryByLabelText } = renderLogin();
    await submitCredentials(getByLabelText);

    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe("tok-abc");
    }, ESPERA);
    expect(queryByLabelText("Código de verificação")).toBeNull();
  });
});
