import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import AdvancedOptions from "../AdvancedOptions";
import { useAuthStore } from "../../store/authStore";
import { useBankStore } from "../../store/bankStore";
import { useCategoriesStore } from "../../store/categoriesStore";
import { usePreferencesStore } from "../../store/preferencesStore";
import { useUserStore } from "../../store/userStore";
import { useWalletStore } from "../../store/walletStore";

jest.mock("../../services/api", () => ({ __esModule: true, default: {} }));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({
      index: 1,
      routes: [{ name: "Main" }, { name: "OpcoesAvancadas" }],
    }),
  }),
  useRoute: () => ({ params: {} }),
  useIsFocused: () => true,
  useFocusEffect: (efeito: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(efeito, []);
  },
}));

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <AdvancedOptions />
    </SafeAreaProvider>,
  );

describe("Opções avançadas", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: "t", userName: "Neemias" } as never);
    useUserStore.setState({ me: null, stats: null } as never);
    useBankStore.setState({ transactions: [] } as never);
    useWalletStore.setState({ transactions: [] } as never);
    useCategoriesStore.setState({ items: [] } as never);
    usePreferencesStore.setState({ notificationsEnabled: true } as never);
  });

  it("abre com o título e o subtítulo da tela", async () => {
    const { getByText } = montar();

    await waitFor(() => expect(getByText("Opções avançadas")).toBeTruthy());
    expect(getByText("Dados, notificações e suporte")).toBeTruthy();
  });

  it("monta mesmo sem nenhum dado carregado", async () => {
    // É a primeira abertura de quem acabou de se cadastrar: nenhuma conta,
    // nenhum extrato, nenhuma categoria própria
    const { getByText } = montar();

    await waitFor(() => expect(getByText("Opções avançadas")).toBeTruthy());
  });
});
