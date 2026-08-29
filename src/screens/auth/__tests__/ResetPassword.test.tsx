import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

import ResetPassword from "../ResetPassword";
import { resetPassword } from "../../../services/api";
import { useToastStore } from "../../../store/toastStore";

// Só a chamada de rede é mockada; getApiErrorDetail continua real para o
// teste cobrir a extração do ProblemDetail de verdade
jest.mock("../../../services/api", () => {
  const actual = jest.requireActual("../../../services/api");
  return {
    ...actual,
    resetPassword: jest.fn(),
  };
});

const mockedResetPassword = resetPassword as jest.MockedFunction<
  typeof resetPassword
>;

// null (e não undefined) sinaliza rota sem token: undefined cairia no default
function renderScreen(token: string | null = "tok-123") {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  const route = { params: token ? { token } : undefined };
  const utils = render(
    <ResetPassword navigation={navigation} route={route} />,
  );
  return { navigation, ...utils };
}

describe("ResetPassword — validações e envio", () => {
  // Espionado (e não real): o showToast verdadeiro agenda um setTimeout de 4s
  // que seguraria o worker do Jest vivo depois da suíte
  let showToastSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    showToastSpy = jest
      .spyOn(useToastStore.getState(), "showToast")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    showToastSpy.mockRestore();
  });

  it("bloqueia senha com menos de 8 caracteres sem chamar a API", () => {
    const { getByLabelText, getByText } = renderScreen();

    fireEvent.changeText(getByLabelText("Nova senha"), "curta12");
    fireEvent.changeText(getByLabelText("Confirmar nova senha"), "curta12");
    fireEvent.press(getByLabelText("Redefinir senha"));

    expect(getByText("A senha deve ter pelo menos 8 caracteres.")).toBeTruthy();
    expect(mockedResetPassword).not.toHaveBeenCalled();
  });

  it("bloqueia confirmação divergente sem chamar a API", () => {
    const { getByLabelText, getByText } = renderScreen();

    fireEvent.changeText(getByLabelText("Nova senha"), "senha-nova-1");
    fireEvent.changeText(
      getByLabelText("Confirmar nova senha"),
      "senha-nova-2",
    );
    fireEvent.press(getByLabelText("Redefinir senha"));

    expect(getByText("As senhas não coincidem.")).toBeTruthy();
    expect(mockedResetPassword).not.toHaveBeenCalled();
  });

  it("exige a confirmação preenchida", () => {
    const { getByLabelText, getByText } = renderScreen();

    fireEvent.changeText(getByLabelText("Nova senha"), "senha-nova-1");
    fireEvent.press(getByLabelText("Redefinir senha"));

    expect(getByText("Confirme a nova senha.")).toBeTruthy();
    expect(mockedResetPassword).not.toHaveBeenCalled();
  });

  it("envia o token da rota com a nova senha e volta ao Login", async () => {
    mockedResetPassword.mockResolvedValueOnce();
    const { getByLabelText, navigation } = renderScreen("tok-123");

    fireEvent.changeText(getByLabelText("Nova senha"), "senha-nova-1");
    fireEvent.changeText(
      getByLabelText("Confirmar nova senha"),
      "senha-nova-1",
    );
    fireEvent.press(getByLabelText("Redefinir senha"));

    await waitFor(() => {
      expect(mockedResetPassword).toHaveBeenCalledWith(
        "tok-123",
        "senha-nova-1",
      );
      expect(navigation.navigate).toHaveBeenCalledWith("Login");
    });
    expect(showToastSpy).toHaveBeenCalledWith(
      expect.stringContaining("Senha redefinida"),
      "success",
    );
  });

  it("exibe a mensagem neutra do backend no erro 400", async () => {
    mockedResetPassword.mockRejectedValueOnce(
      Object.assign(new Error("Request failed"), {
        isAxiosError: true,
        response: {
          status: 400,
          data: { detail: "Token inválido ou expirado" },
        },
      }),
    );
    const { getByLabelText, findByText, navigation } = renderScreen();

    fireEvent.changeText(getByLabelText("Nova senha"), "senha-nova-1");
    fireEvent.changeText(
      getByLabelText("Confirmar nova senha"),
      "senha-nova-1",
    );
    fireEvent.press(getByLabelText("Redefinir senha"));

    expect(await findByText("Token inválido ou expirado")).toBeTruthy();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it("sem token na rota mostra o estado de link inválido", () => {
    const { getByText, queryByLabelText } = renderScreen(null);

    expect(getByText("Link inválido")).toBeTruthy();
    expect(queryByLabelText("Nova senha")).toBeNull();
  });
});
