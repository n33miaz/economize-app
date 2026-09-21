import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import Shopping from "../Shopping";
import { useFamilyStore } from "../../store/familyStore";
import { useShoppingStore } from "../../store/shoppingStore";
import type { ShoppingTrip } from "../../utils/shopping";
import { formatBRL } from "../../utils/money";
import { APP_ROUTES } from "../../routes/routeNames";

jest.mock("../../services/api", () => ({ __esModule: true, default: {} }));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ index: 1, routes: [{ name: "Main" }, { name: "Compras" }] }),
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

const compra = (over: Partial<ShoppingTrip> = {}): ShoppingTrip => ({
  clientId: "t1",
  storeName: "Carrefour",
  status: "OPEN",
  budget: 300,
  startedAt: new Date().toISOString(),
  closedAt: null,
  receiptTotal: null,
  notes: null,
  shareWithFamily: false,
  items: [
    { clientId: "a", name: "Arroz", quantity: 1, unitPrice: 100, promoNote: null, checked: true, photoRef: null, deleted: false, addedByName: null, clientUpdatedAt: "2026-09-21T10:00:00.000Z" },
    { clientId: "b", name: "Feijão", quantity: 2, unitPrice: 106.2, promoNote: null, checked: true, photoRef: null, deleted: false, addedByName: null, clientUpdatedAt: "2026-09-21T10:00:00.000Z" },
  ],
  clientUpdatedAt: "2026-09-21T10:00:00.000Z",
  dirty: false,
  mine: true,
  ownerName: null,
  transactionId: null,
  ...over,
});

const navigate = jest.fn();
const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Shopping navigation={{ navigate }} />
    </SafeAreaProvider>,
  );

describe("Compras", () => {
  beforeEach(() => {
    navigate.mockClear();
    useShoppingStore.getState().reset();
    useShoppingStore.setState({ hasHydrated: true, syncAll: jest.fn().mockResolvedValue(true) } as never);
    useFamilyStore.setState({ hasFamily: false } as never);
  });

  it("sem compra nenhuma o pote convida a começar", async () => {
    const { getByText, getByLabelText } = montar();

    await waitFor(() => expect(getByText("Compras")).toBeTruthy());
    expect(getByLabelText(/^Nenhuma compra ainda\./)).toBeTruthy();
    expect(getByText("Funciona sem sinal")).toBeTruthy();
  });

  it("a compra aberta fica em destaque com a manchete e o orçamento", async () => {
    useShoppingStore.setState({ trips: [compra()] } as never);
    const { getByText, getByLabelText } = montar();

    await waitFor(() => expect(getByText(`${formatBRL(312.4)} · 2 itens`)).toBeTruthy());
    expect(getByText(/passou .* do orçamento/)).toBeTruthy();

    fireEvent.press(getByLabelText(/Carrefour em andamento/));
    expect(navigate).toHaveBeenCalledWith(APP_ROUTES.compra, { clientId: "t1" });
  });

  it("as fechadas ficam abaixo com total e data, e a conciliada diz isso", async () => {
    useShoppingStore.setState({
      trips: [
        compra({ clientId: "f1", storeName: "Dia", status: "CLOSED", closedAt: new Date().toISOString() }),
        compra({ clientId: "f2", storeName: "Assaí", status: "RECONCILED", closedAt: new Date().toISOString() }),
      ],
    } as never);
    const { getByText, getByLabelText } = montar();

    await waitFor(() => expect(getByText("Últimas compras")).toBeTruthy());
    expect(getByLabelText(/^Dia, hoje, /)).toBeTruthy();
    expect(getByLabelText(/^Assaí, hoje, .*conciliada com o extrato$/)).toBeTruthy();
  });

  it("nova compra: a loja anterior vem em um toque, e começar abre a tela da compra", async () => {
    useShoppingStore.setState({
      trips: [compra({ clientId: "f1", status: "CLOSED", budget: 250 })],
    } as never);
    const { getByLabelText } = montar();

    await waitFor(() => expect(getByLabelText("Nova compra")).toBeTruthy());
    fireEvent.press(getByLabelText("Nova compra"));

    await waitFor(() => expect(getByLabelText("Começar a compra")).toBeTruthy());
    // Pré-preenchida com a última: loja e orçamento
    expect(getByLabelText("Onde você está comprando").props.value).toBe("Carrefour");
    expect(getByLabelText("Orçamento (opcional)").props.value).toBe("250,00");

    fireEvent.press(getByLabelText("Começar a compra"));

    const criada = useShoppingStore.getState().trips.find((t) => t.status === "OPEN");
    expect(criada?.storeName).toBe("Carrefour");
    expect(criada?.budget).toBe(250);
    expect(criada?.dirty).toBe(true);
    expect(navigate).toHaveBeenCalledWith(APP_ROUTES.compra, { clientId: criada?.clientId });
  });

  it("sem loja a compra não começa", async () => {
    const { getByLabelText, findByText } = montar();

    fireEvent.press(getByLabelText("Nova compra"));
    await waitFor(() => expect(getByLabelText("Começar a compra")).toBeTruthy());
    fireEvent.press(getByLabelText("Começar a compra"));

    expect(await findByText("Diga onde você está comprando.")).toBeTruthy();
    expect(useShoppingStore.getState().trips).toHaveLength(0);
  });

  it("com casa, oferece compartilhar; sem casa, não", async () => {
    useFamilyStore.setState({ hasFamily: true } as never);
    const { getByLabelText, queryByLabelText } = montar();

    fireEvent.press(getByLabelText("Nova compra"));
    await waitFor(() => expect(getByLabelText("Compartilhar com a casa")).toBeTruthy());

    useFamilyStore.setState({ hasFamily: false } as never);
    await waitFor(() => expect(queryByLabelText("Compartilhar com a casa")).toBeNull());
  });
});
