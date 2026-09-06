import React from "react";
import { Text } from "react-native";
import { render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import PasswordChangeGate from "../PasswordChangeGate";
import { useAuthStore } from "../../store/authStore";
import { useUserStore } from "../../store/userStore";

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ index: 0, routes: [{ name: "Alterar Senha" }] }),
  }),
  useRoute: () => ({ params: {} }),
  useIsFocused: () => true,
  useFocusEffect: (efeito: () => void | (() => void)) => {
    const R = require("react");
    R.useEffect(efeito, []);
  },
}));

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const APP = "Saldo: R$ 4.312,00";

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <PasswordChangeGate>
        <Text>{APP}</Text>
      </PasswordChangeGate>
    </SafeAreaProvider>,
  );

const PERFIL = {
  id: "u1",
  name: "Alice",
  email: "alice@example.com",
  createdAt: null,
  lastLoginAt: null,
};

/**
 * Senha provisória: nada do app antes de trocá-la.
 *
 * <p>Uma conta criada por outra pessoa nasce com uma senha que o dono não
 * escolheu e que alguém mais conhece. O que estes testes travam é que a
 * decisão é do SERVIDOR — o app não inventa a pendência nem a dispensa.
 */
describe("PasswordChangeGate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ token: null, userName: null, hasHydrated: true });
    useUserStore.setState({
      me: null,
      isLoading: false,
      isSaving: false,
      error: null,
      fetchMe: jest.fn(),
    } as never);
  });

  it("sem sessão, não pede nada e não consulta o perfil", () => {
    const fetchMe = jest.fn();
    useUserStore.setState({ fetchMe } as never);

    const { getByText } = montar();

    expect(getByText(APP)).toBeTruthy();
    expect(fetchMe).not.toHaveBeenCalled();
  });

  it("com sessão, busca o perfil uma vez", async () => {
    const fetchMe = jest.fn();
    useAuthStore.setState({ token: "tok" });
    useUserStore.setState({ fetchMe } as never);

    montar();

    await waitFor(() => expect(fetchMe).toHaveBeenCalledTimes(1));
  });

  it("enquanto a resposta não chega, o app segue — a pendência é rara", () => {
    useAuthStore.setState({ token: "tok" });

    const { getByText } = montar();

    // Prender TODA abertura num spinner por causa de um caso raro cobraria o
    // preço no lugar errado; o servidor continua sendo a autoridade
    expect(getByText(APP)).toBeTruthy();
  });

  it("perfil sem pendência libera o app", async () => {
    useAuthStore.setState({ token: "tok" });
    useUserStore.setState({
      me: { ...PERFIL, mustChangePassword: false },
      fetchMe: jest.fn(),
    } as never);

    const { getByText } = montar();

    await waitFor(() => expect(getByText(APP)).toBeTruthy());
  });

  it("servidor antigo, sem o campo, não inventa pendência", async () => {
    useAuthStore.setState({ token: "tok" });
    useUserStore.setState({ me: PERFIL, fetchMe: jest.fn() } as never);

    const { getByText } = montar();

    await waitFor(() => expect(getByText(APP)).toBeTruthy());
  });

  it("com pendência, o app SOME e a única tela é a da troca", async () => {
    useAuthStore.setState({ token: "tok" });
    useUserStore.setState({
      me: { ...PERFIL, mustChangePassword: true },
      fetchMe: jest.fn(),
    } as never);

    const { queryByText, getByText } = montar();

    await waitFor(() => expect(getByText("Crie sua senha")).toBeTruthy());
    // Deixar a conta navegar seria dizer "só você entra aqui" sabendo que
    // não é verdade
    expect(queryByText(APP)).toBeNull();
    expect(
      getByText("Sua senha atual foi definida por outra pessoa"),
    ).toBeTruthy();
  });
});
