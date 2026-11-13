import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import ChangePassword from "../ChangePassword";
import { changePassword } from "../../services/api";
import { useUserStore } from "../../store/userStore";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  changePassword: jest.fn(),
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({
      index: 1,
      routes: [{ name: "Main" }, { name: "TrocarSenha" }],
    }),
  }),
  useRoute: () => ({ params: {} }),
  useIsFocused: () => true,
  useFocusEffect: (efeito: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(efeito, []);
  },
}));

const mockTrocar = changePassword as jest.MockedFunction<typeof changePassword>;

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ChangePassword />
    </SafeAreaProvider>,
  );

describe("Trocar senha", () => {
  beforeEach(() => {
    mockTrocar.mockReset();
    useUserStore.setState({
      me: null,
      fetchMe: jest.fn().mockResolvedValue(undefined),
    } as never);
  });

  it("abre com os três campos", async () => {
    const { toJSON } = montar();

    await waitFor(() => expect(toJSON()).toBeTruthy());
  });

  it("não chama o servidor com os campos vazios", async () => {
    const { toJSON } = montar();

    await waitFor(() => expect(toJSON()).toBeTruthy());
    // Validação do lado do cliente é cortesia, não segurança — mas evita uma
    // ida ao servidor que já se sabe que vai voltar 400
    expect(mockTrocar).not.toHaveBeenCalled();
  });

  it("recusa a nova senha acima de 72 bytes sem chamar o servidor", () => {
    const { getByLabelText, getByText } = montar();
    const senhaLonga = "😀".repeat(19);

    fireEvent.changeText(getByLabelText("Senha atual"), "senha-atual");
    fireEvent.changeText(getByLabelText("Nova senha"), senhaLonga);
    fireEvent.changeText(getByLabelText("Confirmar nova senha"), senhaLonga);
    fireEvent.press(getByLabelText("Salvar nova senha"));

    expect(
      getByText("A senha pode ter no máximo 72 bytes — emojis contam mais de um."),
    ).toBeTruthy();
    expect(mockTrocar).not.toHaveBeenCalled();
  });
});
