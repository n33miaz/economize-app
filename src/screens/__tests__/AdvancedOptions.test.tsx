import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
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
import { useToastStore } from "../../store/toastStore";
import { tidyStatement } from "../../services/api";

const faxina = tidyStatement as jest.MockedFunction<typeof tidyStatement>;

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  tidyStatement: jest.fn(),
}));

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
    faxina.mockReset();
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

  it("reprocessar o extrato conta o que cada varredura mexeu", async () => {
    faxina.mockResolvedValue({
      internalMarked: 197,
      investmentMarked: 350,
      familyMarked: 68,
      duplicatesMarked: 20,
      refundsMarked: 8,
      seriesCreated: 3,
      seriesUpdated: 12,
    });
    const buscar = jest.fn().mockResolvedValue(undefined);
    useBankStore.setState({ transactions: [], fetchTransactions: buscar } as never);

    const { getByText } = montar();
    fireEvent.press(await waitFor(() => getByText("Reprocessar o extrato")));

    await waitFor(() => expect(faxina).toHaveBeenCalled());
    // N\u00famero por n\u00famero: a faxina mexe em SEIS coisas diferentes, e "pronto"
    // n\u00e3o diz em qual delas ela mexeu
    await waitFor(() =>
      expect(useToastStore.getState().message).toContain("20 duplicata(s)"),
    );
    // Os dois vigias novos (EC-214 e EC-194) entram na conta: a frase ficou
    // para tr\u00e1s quando eles nasceram na API
    expect(useToastStore.getState().message).toContain("350 de investimento");
    expect(useToastStore.getState().message).toContain("8 estorno(s)");
    // sem recarregar, a An\u00e1lise mostraria o n\u00famero de antes
    await waitFor(() => expect(buscar).toHaveBeenCalled());
  });

  it("extrato j\u00e1 limpo n\u00e3o vira lista de zeros", async () => {
    faxina.mockResolvedValue({
      internalMarked: 0,
      investmentMarked: 0,
      familyMarked: 0,
      duplicatesMarked: 0,
      refundsMarked: 0,
      seriesCreated: 0,
      seriesUpdated: 0,
    });
    useBankStore.setState({
      transactions: [],
      fetchTransactions: jest.fn().mockResolvedValue(undefined),
    } as never);

    const { getByText } = montar();
    fireEvent.press(await waitFor(() => getByText("Reprocessar o extrato")));

    await waitFor(() =>
      expect(useToastStore.getState().message).toContain("j\u00e1 estava limpo"),
    );
  });

  it("vigia que n\u00e3o achou nada n\u00e3o ocupa a frase de quem achou", async () => {
    faxina.mockResolvedValue({
      internalMarked: 0,
      investmentMarked: 0,
      familyMarked: 0,
      duplicatesMarked: 2,
      refundsMarked: 0,
      seriesCreated: 0,
      seriesUpdated: 0,
    });
    useBankStore.setState({
      transactions: [],
      fetchTransactions: jest.fn().mockResolvedValue(undefined),
    } as never);

    const { getByText } = montar();
    fireEvent.press(await waitFor(() => getByText("Reprocessar o extrato")));

    await waitFor(() =>
      expect(useToastStore.getState().message).toBe("2 duplicata(s)."),
    );
  });

  it("falha ao reprocessar avisa em vez de fingir que deu certo", async () => {
    faxina.mockRejectedValue(new Error("boom"));

    const { getByText } = montar();
    fireEvent.press(await waitFor(() => getByText("Reprocessar o extrato")));

    await waitFor(() =>
      expect(useToastStore.getState().message).toContain("N\u00e3o consegui reprocessar"),
    );
  });
});
