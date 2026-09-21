import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import ShoppingTrip from "../ShoppingTrip";
import { useConfirmStore } from "../../store/confirmStore";
import { useShoppingStore } from "../../store/shoppingStore";
import { formatBRL } from "../../utils/money";
import { tripTotal } from "../../utils/shopping";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  upsertShoppingTrip: jest.fn(),
  getShoppingTrips: jest.fn(),
  getShoppingReconcileCandidates: jest.fn(),
  reconcileShoppingTrip: jest.fn(),
  getShoppingPriceHistory: jest.fn(),
}));

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchCameraAsync: jest.fn(),
}));

jest.mock("../../utils/camera", () => ({
  detectCamera: jest.fn().mockResolvedValue(false),
  shrinkImageForWeb: jest.fn(async (uri: string) => uri),
}));

const mockGoBack = jest.fn();
// Prefixo `mock`: é o que o jest deixa a fábrica do mock enxergar
let mockParams: { clientId?: string } = { clientId: "t1" };

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: mockGoBack,
    canGoBack: () => true,
    getState: () => ({ index: 1, routes: [{ name: "Main" }, { name: "Compra" }] }),
  }),
  useRoute: () => ({ params: mockParams }),
  useIsFocused: () => true,
  useFocusEffect: (efeito: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(efeito, []);
  },
}));

const api = jest.requireMock("../../services/api");

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <ShoppingTrip />
    </SafeAreaProvider>,
  );

function adicionar(
  getByLabelText: (label: string) => any,
  nome: string,
  preco: string,
) {
  fireEvent.changeText(getByLabelText("Nome do item"), nome);
  fireEvent.changeText(getByLabelText("Preço unitário"), preco);
  fireEvent.press(getByLabelText("Adicionar ao carrinho"));
}

describe("Compra (a tela do supermercado)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { clientId: "t1" };
    useShoppingStore.getState().reset();
    useShoppingStore.setState({ hasHydrated: true });
    // A API local não tem os endpoints: o app tem de funcionar assim mesmo
    api.upsertShoppingTrip.mockRejectedValue(new Error("Network Error"));
    api.getShoppingTrips.mockRejectedValue(new Error("Network Error"));
    api.getShoppingPriceHistory.mockRejectedValue(new Error("Network Error"));
    useShoppingStore.setState({
      trips: [
        {
          clientId: "t1",
          storeName: "Carrefour",
          status: "OPEN",
          budget: 100,
          startedAt: new Date().toISOString(),
          closedAt: null,
          receiptTotal: null,
          receiptKey: null,
          receiptIssuerCnpj: null,
          notes: null,
          shareWithFamily: false,
          items: [],
          clientUpdatedAt: new Date().toISOString(),
          dirty: true,
          mine: true,
          ownerName: null,
          transactionId: null,
        },
      ],
    });
  });

  it("adiciona três itens e vê o total, sem servidor nenhum", async () => {
    const { getByLabelText, getByText, getAllByText, findByLabelText } = montar();

    await waitFor(() => expect(getByText("Carrinho vazio")).toBeTruthy());
    fireEvent.press(getByLabelText("Adicionar item"));
    await waitFor(() => expect(getByLabelText("Nome do item")).toBeTruthy());

    adicionar(getByLabelText, "Arroz", "24,90");
    adicionar(getByLabelText, "Feijão", "8,50");
    adicionar(getByLabelText, "Café", "16,60");

    expect(await findByLabelText(`Total ${formatBRL(50)}, 3 itens`)).toBeTruthy();
    expect(getByText("3 itens")).toBeTruthy();
    // "Arroz" aparece na linha E como sugestão na folha, que segue aberta
    // de propósito para o próximo item
    expect(getAllByText("Arroz").length).toBeGreaterThan(0);
    expect(getByText(`1 × ${formatBRL(24.9)}`)).toBeTruthy();
    // A rede falhou e nada quebrou: a linha diz que está salvo aqui
    expect(getByText("Ainda não sincronizado · salvo neste aparelho")).toBeTruthy();
    expect(useShoppingStore.getState().trips[0].items).toHaveLength(3);
  });

  it("escreve a lista e ela vai dando check conforme o que é anotado", async () => {
    const { getByLabelText, getByText, findByText, queryByText } = montar();

    await waitFor(() => expect(getByText("Carrinho vazio")).toBeTruthy());

    // 1. Escrever a lista antes de entrar no mercado, de uma vez só
    fireEvent.press(getByText("Escrever a lista"));
    await waitFor(() => expect(getByLabelText("Item da lista")).toBeTruthy());
    fireEvent.changeText(getByLabelText("Item da lista"), "Arroz\nFeijão\nCafé");
    fireEvent.press(getByLabelText("Adicionar à lista"));

    // A lista aparece como o que FALTA, e não custa nada ainda
    expect(await findByText("Faltam 3 itens")).toBeTruthy();
    expect(queryByText("No carrinho · 3 itens")).toBeNull();
    expect(useShoppingStore.getState().trips[0].items).toHaveLength(3);
    expect(tripTotal(useShoppingStore.getState().trips[0])).toBe(0);

    // 2. No corredor: anotar o café com o preço da etiqueta
    fireEvent.press(getByLabelText("Fechar"));
    fireEvent.press(getByLabelText("Adicionar item"));
    await waitFor(() => expect(getByLabelText("Nome do item")).toBeTruthy());
    adicionar(getByLabelText, "café", "16,60");

    // O item da lista foi CUMPRIDO: some do que falta, entra no carrinho, e
    // não virou uma segunda linha de café
    expect(await findByText("Faltam 2 itens")).toBeTruthy();
    expect(getByText("No carrinho · 1 item")).toBeTruthy();
    const compra = useShoppingStore.getState().trips[0];
    expect(compra.items).toHaveLength(3);
    expect(compra.items.filter((i) => i.checked)).toHaveLength(1);
    expect(tripTotal(compra)).toBe(16.6);
  });

  it("item da lista diz 'a pegar' em vez de reclamar que falta preço", async () => {
    const { getByLabelText, getByText, findByText } = montar();

    await waitFor(() => expect(getByText("Carrinho vazio")).toBeTruthy());
    fireEvent.press(getByText("Escrever a lista"));
    await waitFor(() => expect(getByLabelText("Item da lista")).toBeTruthy());
    fireEvent.changeText(getByLabelText("Item da lista"), "Arroz");
    fireEvent.press(getByLabelText("Adicionar à lista"));

    // Ninguém foi buscar o preço ainda — "sem preço" ali soaria a dado faltando
    expect(await findByText("1 un · a pegar")).toBeTruthy();
  });

  it("o mesmo nome escrito duas vezes não entra duas vezes na lista", async () => {
    const { getByLabelText, getByText, findByText } = montar();

    await waitFor(() => expect(getByText("Carrinho vazio")).toBeTruthy());
    fireEvent.press(getByText("Escrever a lista"));
    await waitFor(() => expect(getByLabelText("Item da lista")).toBeTruthy());
    fireEvent.changeText(getByLabelText("Item da lista"), "Arroz");
    fireEvent.press(getByLabelText("Adicionar à lista"));
    await findByText("Falta 1 item");

    fireEvent.changeText(getByLabelText("Item da lista"), "arroz");
    fireEvent.press(getByLabelText("Adicionar à lista"));

    // Dizer o motivo é mais útil que um silêncio que parece falha
    expect(await findByText("Esse já está na lista.")).toBeTruthy();
    expect(useShoppingStore.getState().trips[0].items).toHaveLength(1);
  });

  it("passar do orçamento pinta o aviso", async () => {
    const { getByLabelText, findByText } = montar();

    fireEvent.press(getByLabelText("Adicionar item"));
    await waitFor(() => expect(getByLabelText("Nome do item")).toBeTruthy());
    adicionar(getByLabelText, "Carne", "130");

    expect(await findByText(`passou ${formatBRL(30)} do orçamento de ${formatBRL(100)}`)).toBeTruthy();
  });

  it("desmarcar tira da conta sem tirar da lista", async () => {
    const { getByLabelText, findByLabelText, getByText } = montar();

    fireEvent.press(getByLabelText("Adicionar item"));
    await waitFor(() => expect(getByLabelText("Nome do item")).toBeTruthy());
    adicionar(getByLabelText, "Arroz", "10");
    adicionar(getByLabelText, "Feijão", "5");
    await findByLabelText(`Total ${formatBRL(15)}, 2 itens`);

    fireEvent.press(getByLabelText("Desmarcar Feijão"));

    expect(await findByLabelText(`Total ${formatBRL(10)}, 1 item`)).toBeTruthy();
    expect(getByText("1 item · 1 não pego")).toBeTruthy();
  });

  it("segurar o item pede confirmação e tira do carrinho", async () => {
    const { getByLabelText, findByLabelText, queryByLabelText } = montar();

    fireEvent.press(getByLabelText("Adicionar item"));
    await waitFor(() => expect(getByLabelText("Nome do item")).toBeTruthy());
    adicionar(getByLabelText, "Arroz", "10");
    await findByLabelText(`Total ${formatBRL(10)}, 1 item`);

    fireEvent(getByLabelText(/^Arroz, 1 × /), "longPress");
    const pedido = useConfirmStore.getState().request;
    expect(pedido?.title).toBe("Tirar do carrinho?");
    await pedido?.onConfirm();

    await waitFor(() => expect(queryByLabelText(/^Arroz, 1 × /)).toBeNull());
    expect(useShoppingStore.getState().trips[0].items[0].deleted).toBe(true);
  });

  it("fecha a compra com o total da nota e explica que sobe depois", async () => {
    const { getByLabelText, findByText, findByLabelText, queryByLabelText, getAllByText } = montar();

    fireEvent.press(getByLabelText("Adicionar item"));
    await waitFor(() => expect(getByLabelText("Nome do item")).toBeTruthy());
    adicionar(getByLabelText, "Arroz", "10");
    await findByLabelText(`Total ${formatBRL(10)}, 1 item`);
    // A folha do item fecha antes de fechar a compra, como no caixa
    fireEvent.press(getByLabelText("Fechar"));

    fireEvent.press(getByLabelText("Fechar compra"));
    await waitFor(() => expect(getByLabelText("Total da nota")).toBeTruthy());
    fireEvent.changeText(getByLabelText("Total da nota"), "12,50");
    fireEvent.press(getByLabelText("Confirmar fechamento da compra"));

    await waitFor(() => expect(useShoppingStore.getState().trips[0].status).toBe("CLOSED"));
    expect(useShoppingStore.getState().trips[0].receiptTotal).toBe(12.5);
    // Sem rede: a folha explica em vez de girar para sempre
    expect(await findByText(/Sem conexão agora/)).toBeTruthy();
    // A conferência com a nota aparece no card E na folha: as duas contam
    expect(getAllByText(/veio .* acima do carrinho/).length).toBeGreaterThan(0);
    // O rodapé de "+ item" some com a compra fechada
    expect(queryByLabelText("Adicionar item")).toBeNull();
  });

  it("o fechamento oferece ler o QR da nota fiscal", async () => {
    const { getByLabelText, getByText, findByLabelText } = montar();

    await waitFor(() => expect(getByText("Carrinho vazio")).toBeTruthy());
    fireEvent.press(getByLabelText("Adicionar item"));
    await waitFor(() => expect(getByLabelText("Nome do item")).toBeTruthy());
    adicionar(getByLabelText, "Arroz", "24,90");
    fireEvent.press(getByLabelText("Fechar"));
    fireEvent.press(getByLabelText("Fechar compra"));

    // O botão do QR fica ACIMA do total: ler a nota é o gesto que preenche o
    // número, não o contrário
    expect(await findByLabelText("Ler o QR da nota fiscal")).toBeTruthy();
    expect(getByLabelText("Total da nota")).toBeTruthy();
  });

  it("compra que não existe neste aparelho não quebra a tela", async () => {
    mockParams = { clientId: "nao-existe" };
    const { findByText } = montar();

    expect(await findByText("Compra não encontrada")).toBeTruthy();
  });
});
