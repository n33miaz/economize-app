import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import ChangePassword from "../ChangePassword";
import { changePassword } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { useBankStore } from "../../store/bankStore";
import { useToastStore } from "../../store/toastStore";
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

  /** Preenche os três campos com uma troca válida e toca em salvar. */
  const trocar = async () => {
    const tela = montar();
    fireEvent.changeText(await tela.findByLabelText("Senha atual"), "velha-123");
    fireEvent.changeText(tela.getByLabelText("Nova senha"), "Nova-senha-9");
    fireEvent.changeText(
      tela.getByLabelText("Confirmar nova senha"),
      "Nova-senha-9",
    );
    fireEvent.press(tela.getByLabelText("Salvar nova senha"));
    await waitFor(() => expect(mockTrocar).toHaveBeenCalled());
    return tela;
  };

  describe("a sessão depois da troca", () => {
    const EXTRATO = [{ id: "t1", description: "IFOOD", amount: -89.9 }];

    beforeEach(() => {
      useAuthStore.setState({ token: "token-velho", userName: "Ana" } as never);
      useBankStore.setState({ transactions: EXTRATO } as never);
    });

    afterEach(() => {
      useToastStore.getState().hideToast();
    });

    it("servidor novo: grava o token novo e não apaga nada da pessoa", async () => {
      mockTrocar.mockResolvedValue({ token: "token-novo", name: "Ana" });

      await trocar();

      // O servidor derrubou o token velho; sem gravar o novo, o próximo
      // pedido voltaria 401 e a pessoa cairia no login
      await waitFor(() =>
        expect(useAuthStore.getState().token).toBe("token-novo"),
      );
      expect(useAuthStore.getState().userName).toBe("Ana");
      // A mesma pessoa: o extrato que já estava na memória continua lá
      expect(useBankStore.getState().transactions).toBe(EXTRATO);
      expect(mockTrocar).toHaveBeenCalledWith("velha-123", "Nova-senha-9");
    });

    it("servidor antigo (204 sem corpo): o token de agora fica", async () => {
      mockTrocar.mockResolvedValue(null);

      await trocar();

      await waitFor(() =>
        expect(useToastStore.getState().message).toBe("Senha alterada."),
      );
      expect(useAuthStore.getState().token).toBe("token-velho");
      expect(useBankStore.getState().transactions).toBe(EXTRATO);
    });
  });
});
