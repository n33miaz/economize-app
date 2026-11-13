import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import Register from "../Register";
import api from "../../../services/api";
import { useAuthStore } from "../../../store/authStore";

jest.mock("../../../services/api", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const mockedPost = api.post as jest.Mock;

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderRegister() {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  return render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Register navigation={navigation} />
    </SafeAreaProvider>,
  );
}

function preencher(
  getByLabelText: any,
  campos: { nome?: string; email?: string; senha?: string },
) {
  if (campos.nome !== undefined) {
    fireEvent.changeText(getByLabelText("Nome Completo"), campos.nome);
  }
  if (campos.email !== undefined) {
    fireEvent.changeText(getByLabelText("E-mail"), campos.email);
  }
  if (campos.senha !== undefined) {
    fireEvent.changeText(getByLabelText("Senha"), campos.senha);
    fireEvent.changeText(getByLabelText("Confirmar senha"), campos.senha);
  }
}

describe("Register", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      token: null,
      userName: null,
      isLoading: false,
      error: null,
    });
  });

  it("abre sem o erro deixado pelo Login", () => {
    useAuthStore.setState({ error: "E-mail ou senha incorretos." });

    const { queryByText } = renderRegister();

    expect(queryByText("E-mail ou senha incorretos.")).toBeNull();
  });

  it("estado antigo gravado 'carregando' não desabilita o Cadastrar", async () => {
    // Uma versão anterior gravava o estado inteiro: fechar o app no meio de
    // um login lento deixava isLoading=true no disco
    (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(
        JSON.stringify({
          state: { token: null, isLoading: true, error: "Erro antigo." },
          version: 0,
        }),
      ),
    );
    await useAuthStore.persist.rehydrate();

    const { getByLabelText, getByText, queryByText } = renderRegister();

    expect(
      getByLabelText("Cadastrar").props.accessibilityState?.disabled,
    ).toBeFalsy();
    // o texto no lugar do giratório: não está "carregando"
    expect(getByText("Cadastrar")).toBeTruthy();
    expect(queryByText("Erro antigo.")).toBeNull();
  });

  it("campos vazios dizem o que falta, sem chamar o servidor", () => {
    const { getByLabelText, getByText } = renderRegister();

    fireEvent.press(getByLabelText("Cadastrar"));

    expect(getByText("Digite seu nome.")).toBeTruthy();
    expect(getByText("Digite seu e-mail.")).toBeTruthy();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("e-mail sem formato é recusado na tela", () => {
    const { getByLabelText, getByText } = renderRegister();
    preencher(getByLabelText, {
      nome: "Ana",
      email: "ana-sem-arroba",
      senha: "Senha-forte-123",
    });

    fireEvent.press(getByLabelText("Cadastrar"));

    expect(getByText("Digite um e-mail válido.")).toBeTruthy();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("o e-mail vai sem espaços nas pontas e com a caixa que foi digitada", async () => {
    mockedPost.mockResolvedValue({ data: { token: "tok", name: "Ana" } });
    const { getByLabelText } = renderRegister();
    preencher(getByLabelText, {
      nome: "Ana",
      email: "  Ana@Teste.com ",
      senha: "Senha-forte-123",
    });

    fireEvent.press(getByLabelText("Cadastrar"));

    await waitFor(() => expect(mockedPost).toHaveBeenCalled());
    expect(mockedPost).toHaveBeenCalledWith("/auth/register", {
      name: "Ana",
      email: "Ana@Teste.com",
      password: "Senha-forte-123",
    });
  });
});
