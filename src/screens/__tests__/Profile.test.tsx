import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import Profile from "../Profile";
import { useAuthStore } from "../../store/authStore";
import { usePlanStore } from "../../store/planStore";
import { usePreferencesStore } from "../../store/preferencesStore";
import { useUserStore } from "../../store/userStore";

jest.mock("../../services/api", () => ({ __esModule: true, default: {} }));

jest.mock("../../utils/biometrics", () => ({
  biometricSupport: jest.fn().mockResolvedValue({ available: false }),
  enrollBiometrics: jest.fn(),
  forgetBiometrics: jest.fn(),
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ index: 0, routes: [{ name: "Perfil" }] }),
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

const EU = {
  id: "u1",
  name: "Neemias Cormino Manso",
  email: "ncormino@gmail.com",
  createdAt: "2026-02-26T20:17:08Z",
  lastLoginAt: "2026-09-07T12:22:26Z",
  mustChangePassword: false,
};

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Profile />
    </SafeAreaProvider>,
  );

describe("Perfil", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: "t", userName: "Neemias" } as never);
    useUserStore.setState({
      me: EU,
      stats: { bankTransactions: 1752, walletTransactions: 12, reports: 3 },
      isLoading: false,
      isLoadingStats: false,
      isSaving: false,
      error: null,
      fetchMe: jest.fn().mockResolvedValue(undefined),
      fetchStats: jest.fn().mockResolvedValue(undefined),
      updateName: jest.fn().mockResolvedValue(true),
    } as never);
    usePreferencesStore.setState({
      theme: "dark",
      biometricLogin: false,
      defaultCurrency: "BRL",
      language: "pt-BR",
      viewDepth: "simple",
    } as never);
    usePlanStore.setState({ plan: "FREE", adsEnabled: true });
  });

  it("mostra os três contadores vindos do servidor", async () => {
    const { getByText } = montar();

    // Os números vêm CONTADOS de /users/me/stats: a tela não baixa mais as
    // três listas inteiras (100 KB só de extrato) para chegar a eles
    await waitFor(() => expect(getByText("1752")).toBeTruthy());
    expect(getByText("12")).toBeTruthy();
    expect(getByText("3")).toBeTruthy();
  });

  it("pede perfil e contadores ao abrir, e nada além disso", async () => {
    const fetchMe = jest.fn().mockResolvedValue(undefined);
    const fetchStats = jest.fn().mockResolvedValue(undefined);
    useUserStore.setState({ fetchMe, fetchStats } as never);

    montar();

    await waitFor(() => expect(fetchMe).toHaveBeenCalled());
    expect(fetchStats).toHaveBeenCalled();
  });

  it("conta gratuita vê o convite do Plus na linha do plano", async () => {
    const { getByText } = montar();

    await waitFor(() =>
      expect(getByText("Gratuito · veja o que o Plus adiciona")).toBeTruthy(),
    );
  });

  it("conta Plus vê o plano ativo, não o convite", async () => {
    usePlanStore.setState({ plan: "PLUS", adsEnabled: false });

    const { getByText, queryByText } = montar();

    await waitFor(() => expect(getByText("Plus ativo — sem anúncios")).toBeTruthy());
    expect(queryByText("Gratuito · veja o que o Plus adiciona")).toBeNull();
  });

  it("contadores ainda não carregados não viram zero na tela", async () => {
    // Zero é uma afirmação ("você não tem transação nenhuma") e seria mentira
    // enquanto a resposta não chegou: o lugar mostra esqueleto
    useUserStore.setState({ stats: null, isLoadingStats: true } as never);

    const { queryByText } = montar();

    await waitFor(() => expect(queryByText("1752")).toBeNull());
  });
});
