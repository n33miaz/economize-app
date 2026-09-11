import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import Watchmen from "../Watchmen";
import {
  type Watchman,
  type WatchmanNote,
  getWatchmanNotes,
  getWatchmen,
  undoSweepRun,
} from "../../services/api";
import { useBankStore } from "../../store/bankStore";
import { useConfirmStore } from "../../store/confirmStore";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  getWatchmen: jest.fn(),
  getWatchmanNotes: jest.fn(),
  undoSweepRun: jest.fn(),
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ type: "stack", index: 1, routes: [{ name: "Vigias" }] }),
  }),
  useRoute: () => ({ params: {} }),
  useIsFocused: () => true,
  useFocusEffect: (efeito: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(efeito, []);
  },
}));

const quem = getWatchmen as jest.MockedFunction<typeof getWatchmen>;
const recados = getWatchmanNotes as jest.MockedFunction<typeof getWatchmanNotes>;
const desfazer = undoSweepRun as jest.MockedFunction<typeof undoSweepRun>;

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const VIGIA: Watchman = {
  kind: "DUPLICATE",
  name: "Vigia da cópia",
  role: "Acha a linha que entrou pela conexão E por um arquivo.",
  frequency: "a cada importação de extrato",
  undoable: true,
};

const nota = (patch: Partial<WatchmanNote> = {}): WatchmanNote => ({
  runId: "r1",
  kind: "DUPLICATE",
  watchman: "Vigia da cópia",
  role: "Acha a linha que entrou pela conexão E por um arquivo.",
  message: "Encontrei 18 pares duplicados. Isso muda R$ 1.204,50 nas suas somas.",
  affected: 18,
  volume: 1204.5,
  ranAt: new Date().toISOString(),
  undone: false,
  canUndo: true,
  ...patch,
});

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Watchmen />
    </SafeAreaProvider>,
  );

/**
 * EC-202 na tela.
 *
 * O que se prova aqui é a prestação de contas: quem trabalha aparece antes da
 * primeira passada, o recado diz o que mudou, e o desfazer só existe onde ele
 * funciona de verdade.
 */
describe("Vigias", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useConfirmStore.setState({ request: null } as never);
    useBankStore.setState({
      transactions: [],
      fetchTransactions: jest.fn().mockResolvedValue(undefined),
    } as never);
  });

  it("quem trabalha aparece mesmo sem passada nenhuma", async () => {
    quem.mockResolvedValue([VIGIA]);
    recados.mockResolvedValue([]);

    const { getByText } = montar();

    await waitFor(() => expect(getByText("Vigia da cópia")).toBeTruthy());
    expect(
      getByText("Acha a linha que entrou pela conexão E por um arquivo."),
    ).toBeTruthy();
    expect(getByText(/Nenhuma passada ainda/)).toBeTruthy();
  });

  it("o recado do servidor vai inteiro para a tela", async () => {
    quem.mockResolvedValue([VIGIA]);
    recados.mockResolvedValue([nota()]);

    const { getByText } = montar();

    await waitFor(() =>
      expect(
        getByText("Encontrei 18 pares duplicados. Isso muda R$ 1.204,50 nas suas somas."),
      ).toBeTruthy(),
    );
  });

  it("vigia sem desfazer não ganha botão, e a frase diz para onde ir", async () => {
    quem.mockResolvedValue([VIGIA]);
    recados.mockResolvedValue([
      nota({ kind: "RECURRENCE", watchman: "Vigia do que se repete", canUndo: false }),
    ]);

    const { getByText, queryByText } = montar();

    await waitFor(() => expect(getByText(/tela de Recorrências/)).toBeTruthy());
    // Botão que não faz o que promete é pior do que botão nenhum
    expect(queryByText("Desfazer")).toBeNull();
  });

  it("passada já desfeita continua no histórico, marcada", async () => {
    quem.mockResolvedValue([VIGIA]);
    recados.mockResolvedValue([nota({ undone: true, canUndo: false })]);

    const { getByText, queryByText } = montar();

    await waitFor(() => expect(getByText("Você desfez esta passada.")).toBeTruthy());
    expect(queryByText("Desfazer")).toBeNull();
  });

  it("desfazer pede confirmação antes de mexer em número", async () => {
    quem.mockResolvedValue([VIGIA]);
    recados.mockResolvedValue([nota()]);

    const { findByText } = montar();
    fireEvent.press(await findByText("Desfazer"));

    await waitFor(() => expect(useConfirmStore.getState().request).not.toBeNull());
    expect(desfazer).not.toHaveBeenCalled();
  });

  it("confirmado, solta a passada e recarrega o extrato", async () => {
    quem.mockResolvedValue([VIGIA]);
    recados.mockResolvedValue([nota()]);
    desfazer.mockResolvedValue(nota({ undone: true, canUndo: false }));
    const recarregar = jest.fn().mockResolvedValue(undefined);
    useBankStore.setState({ transactions: [], fetchTransactions: recarregar } as never);

    const { findByText } = montar();
    fireEvent.press(await findByText("Desfazer"));

    await waitFor(() => expect(useConfirmStore.getState().request).not.toBeNull());
    await act(async () => {
      await useConfirmStore.getState().request!.onConfirm();
    });

    expect(desfazer).toHaveBeenCalledWith("r1");
    // Sem recarregar, a Análise mostraria o número de antes
    await waitFor(() => expect(recarregar).toHaveBeenCalled());
  });

  it("falha ao ler se explica e oferece tentar de novo", async () => {
    quem.mockRejectedValue(new Error("sem rede"));
    recados.mockRejectedValue(new Error("sem rede"));

    const { getByText } = montar();

    await waitFor(() =>
      expect(getByText(/Não consegui ler o histórico dos vigias agora/)).toBeTruthy(),
    );
  });
});
