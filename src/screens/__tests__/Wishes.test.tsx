import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import Wishes from "../Wishes";
import WishContributionSheet from "../../components/WishContributionSheet";
import { useWishStore } from "../../store/wishStore";
import { usePlanStore } from "../../store/planStore";

jest.mock("../../services/api", () => ({ __esModule: true, default: {} }));

jest.mock("../../components/WishContributionSheet", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ index: 1, routes: [{ name: "Main" }, { name: "Desejos" }] }),
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

const BASE_VAZIA = {
  baseline: null,
  wishes: [],
  income: null,
  committed: null,
  isLoading: false,
  hasLoadedOnce: true,
  isSaving: false,
  isIncomeLoading: false,
  hasLoadedIncomeOnce: true,
  isCommittedLoading: false,
  hasLoadedCommittedOnce: true,
  error: null,
  incomeError: null,
  committedError: null,
  fetch: jest.fn().mockResolvedValue(undefined),
  fetchIncome: jest.fn().mockResolvedValue(undefined),
  fetchCommitted: jest.fn().mockResolvedValue(undefined),
};

/** Retrato financeiro que a tela usa para traduzir preço em horas de vida. */
const BASELINE = {
  workIncome: 2628,
  hourlyRate: 14.93,
  hoursPerMonth: 176,
  monthlyLeftover: 420.5,
  monthlyExpense: 2207.5,
  cyclesConsidered: 3,
  gaps: [],
  lastClosedCycle: { cycleMonth: "2026-10", start: "2026-10-05", end: "2026-11-04", leftover: 300 },
};

const desejo = (id: string, nome: string, valor: number, status: "WISH" | "GOAL" = "WISH") =>
  ({
    id,
    name: nome,
    targetAmount: valor,
    savedAmount: 0,
    categoryId: null,
    status,
    targetDate: null,
    note: null,
    purchasedAt: null,
    purchaseTransactionId: null,
    // A projeção é o coração da tela: é ela que traduz preço em horas de vida
    projection: {
      remaining: valor,
      hoursOfWork: 160.8,
      workDays: 20.1,
      workMonths: 0.9,
      workYears: null,
      monthsToAfford: 6,
      estimatedDate: "2027-03-01",
      installments: null,
      maxInstallment: null,
      // o detalhe da meta percorre os "e se"; vazio = nenhum atalho a sugerir
      whatIfs: [],
    },
  }) as never;

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Wishes />
    </SafeAreaProvider>,
  );

describe("Desejos", () => {
  beforeEach(() => {
    useWishStore.setState(BASE_VAZIA as never);
    usePlanStore.setState({ plan: "FREE", adsEnabled: true });
    (WishContributionSheet as unknown as jest.Mock).mockClear();
  });

  it("sem desejo nenhum a tela abre e convida a criar", async () => {
    const { getByText, getByLabelText } = montar();

    await waitFor(() => expect(getByText("Desejos")).toBeTruthy());
    // EC-231: o vazio é contado pelo pote, numa frase só para quem ouve
    expect(
      getByLabelText(/^Nenhum desejo ainda\. Cadastre algo que você quer comprar/),
    ).toBeTruthy();
    // EC-228: a primeira visita explica o que "horas da sua vida" quer dizer
    expect(getByText("O preço em horas da sua vida")).toBeTruthy();
  });

  it("mostra o desejo cadastrado", async () => {
    useWishStore.setState({
      ...BASE_VAZIA,
      baseline: BASELINE,
      wishes: [desejo("w1", "Bicicleta", 2400)],
    } as never);

    const { getByText } = montar();

    await waitFor(() => expect(getByText("Bicicleta")).toBeTruthy());
  });

  it("propõe a sobra apurada do ciclo fechado, nunca a mediana estimada", async () => {
    useWishStore.setState({
      ...BASE_VAZIA,
      baseline: { ...BASELINE, monthlyLeftover: 420.5 },
      wishes: [desejo("w1", "Moto", 18000, "GOAL")],
    } as never);
    const { getByLabelText } = montar();

    fireEvent.press(await waitFor(() => getByLabelText(/^Moto,/)));
    fireEvent.press(getByLabelText("Guardar dinheiro para Moto"));

    await waitFor(() =>
      expect((WishContributionSheet as unknown as jest.Mock).mock.calls.at(-1)?.[0])
        .toMatchObject({
          leftover: { amount: 300, cycleMonth: "2026-10", start: "2026-10-05", end: "2026-11-04" },
        }),
    );
  });

  it.each([
    ["sem ciclo fechado com dados", null],
    ["ciclo fechado sem sobra", { cycleMonth: "2026-10", start: "2026-10-05", end: "2026-11-04", leftover: 0 }],
    ["ciclo fechado no vermelho", { cycleMonth: "2026-10", start: "2026-10-05", end: "2026-11-04", leftover: -120 }],
  ])("%s: nada é proposto, mesmo com mediana positiva", async (_caso, ciclo) => {
    useWishStore.setState({
      ...BASE_VAZIA,
      baseline: { ...BASELINE, monthlyLeftover: 420.5, lastClosedCycle: ciclo },
      wishes: [desejo("w1", "Moto", 18000, "GOAL")],
    } as never);
    const { getByLabelText } = montar();

    fireEvent.press(await waitFor(() => getByLabelText(/^Moto,/)));
    fireEvent.press(getByLabelText("Guardar dinheiro para Moto"));

    await waitFor(() =>
      expect((WishContributionSheet as unknown as jest.Mock).mock.calls.at(-1)?.[0])
        .toMatchObject({ visible: true, leftover: null }),
    );
  });

  it("dois toques rápidos no salvar criam UM desejo", async () => {
    // A criação fica pendurada: o `isSaving` do store só chegaria no render
    // seguinte, e é a trava por ref que segura o segundo toque
    let concluir: () => void = () => {};
    const create = jest.fn(
      () =>
        new Promise((resolve) => {
          concluir = () => resolve({ ok: true, message: "Desejo salvo." });
        }),
    );
    useWishStore.setState({ ...BASE_VAZIA, create } as never);
    const { getByLabelText } = montar();

    fireEvent.press(await waitFor(() => getByLabelText("Cadastrar desejo")));
    fireEvent.changeText(getByLabelText("O que você quer"), "Bicicleta");
    fireEvent.changeText(getByLabelText("Quanto custa"), "2400");
    const salvar = getByLabelText("Salvar desejo");
    fireEvent.press(salvar);
    fireEvent.press(salvar);

    expect(create).toHaveBeenCalledTimes(1);
    concluir();
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  });

  it("depois de guardar, a folha recebe o desejo atualizado do store", async () => {
    useWishStore.setState({
      ...BASE_VAZIA,
      baseline: BASELINE,
      wishes: [desejo("w1", "Moto", 18000, "GOAL")],
    } as never);
    const { getByLabelText } = montar();

    fireEvent.press(await waitFor(() => getByLabelText(/^Moto,/)));
    fireEvent.press(getByLabelText("Guardar dinheiro para Moto"));
    await waitFor(() =>
      expect((WishContributionSheet as unknown as jest.Mock).mock.calls.at(-1)?.[0])
        .toMatchObject({ visible: true, wish: { id: "w1", savedAmount: 0 } }),
    );

    // a recarga depois do aporte troca o objeto no store; a folha não pode
    // seguir com a cópia de antes
    const atualizado = { ...(desejo("w1", "Moto", 18000, "GOAL") as object), savedAmount: 500 };
    useWishStore.setState({ wishes: [atualizado] } as never);

    await waitFor(() =>
      expect((WishContributionSheet as unknown as jest.Mock).mock.calls.at(-1)?.[0])
        .toMatchObject({ wish: { id: "w1", savedAmount: 500 } }),
    );
  });

  it("busca a lista na primeira abertura", async () => {
    const fetch = jest.fn().mockResolvedValue(undefined);
    useWishStore.setState({ ...BASE_VAZIA, hasLoadedOnce: false, fetch } as never);

    montar();

    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it("já carregado, voltar à tela não repete a busca", async () => {
    // `hasLoadedOnce` é o que evita uma requisição por foco: a lista de
    // desejos muda quando o usuário mexe nela, não quando ele troca de aba
    const fetch = jest.fn().mockResolvedValue(undefined);
    useWishStore.setState({ ...BASE_VAZIA, hasLoadedOnce: true, fetch } as never);

    montar();

    await waitFor(() => expect(fetch).not.toHaveBeenCalled());
  });

  it("no Plus o slot de anúncio não ocupa espaço", async () => {
    usePlanStore.setState({ plan: "PLUS", adsEnabled: false });

    const { queryByText, getByText } = montar();

    await waitFor(() => expect(getByText("Desejos")).toBeTruthy());
    expect(queryByText("Publicidade")).toBeNull();
  });
});
