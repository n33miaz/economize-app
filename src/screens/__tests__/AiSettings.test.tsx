import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import AiSettings from "../AiSettings";
import { useAiSettingsStore } from "../../store/aiSettingsStore";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  // A tela lê o status do erro para separar "sem cofre" de "deu ruim"
  getApiErrorStatus: jest.fn(() => null),
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ index: 1, routes: [{ name: "Main" }, { name: "OpcoesIA" }] }),
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

const CATALOGO = {
  // `byokAvailable: false` é o estado da produção HOJE: sem
  // SECRET_ENCRYPTION_KEY no painel, a chave própria some da tela
  byokAvailable: true,
  serverKeyAvailable: true,
  providers: [
    { id: "GEMINI", name: "Google Gemini", models: ["gemini-2.0-flash"] },
  ],
};

const BASE = {
  catalog: CATALOGO,
  settings: { provider: "GEMINI", model: "gemini-2.0-flash", keyStatus: "NONE" },
  isLoading: false,
  hasLoadedOnce: true,
  error: null,
  isSaving: false,
  isTesting: false,
  testResult: null,
  load: jest.fn().mockResolvedValue(undefined),
};

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <AiSettings />
    </SafeAreaProvider>,
  );

describe("Opções de IA", () => {
  beforeEach(() => {
    useAiSettingsStore.setState(BASE as never);
  });

  it("abre com o provedor do catálogo", async () => {
    const { getByText } = montar();

    await waitFor(() => expect(getByText("Opções de IA")).toBeTruthy());
  });

  it("instalação sem cofre não oferece chave própria", async () => {
    // `byokAvailable: false` é exatamente a produção de hoje. A opção some
    // em vez de aparecer quebrada — quem decide é o servidor
    useAiSettingsStore.setState({
      ...BASE,
      catalog: { ...CATALOGO, byokAvailable: false },
    } as never);

    const { getByText } = montar();

    await waitFor(() => expect(getByText("Opções de IA")).toBeTruthy());
  });

  it("busca o catálogo ao abrir", async () => {
    const load = jest.fn().mockResolvedValue(undefined);
    useAiSettingsStore.setState({ ...BASE, hasLoadedOnce: false, load } as never);

    montar();

    await waitFor(() => expect(load).toHaveBeenCalled());
  });

  it("falha ao carregar mostra a saída para tentar de novo", async () => {
    useAiSettingsStore.setState({
      ...BASE,
      catalog: null,
      settings: null,
      // `hasLoadedOnce: false` é o que distingue "nunca consegui carregar"
      // de "carreguei e depois falhou" — só o primeiro troca a tela inteira
      hasLoadedOnce: false,
      error: "Não foi possível carregar as opções de IA.",
    } as never);

    const { getByText } = montar();

    await waitFor(() => expect(getByText("Tentar de novo")).toBeTruthy());
  });
});
