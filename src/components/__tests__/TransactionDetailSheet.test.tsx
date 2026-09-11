import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import TransactionDetailSheet from "../TransactionDetailSheet";
import { useAccountsStore } from "../../store/accountsStore";
import { useCategoriesStore } from "../../store/categoriesStore";
import { useFamilyStore } from "../../store/familyStore";
import {
  applyReview,
  setFamilyTransfer,
  setInternalTransfer,
  setTransactionIgnored,
} from "../../services/api";

import type { BankTransaction } from "../../services/api";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  renameTransaction: jest.fn(),
  setInternalTransfer: jest.fn(),
  setFamilyTransfer: jest.fn(),
  setTransactionIgnored: jest.fn(),
  applyReview: jest.fn(),
  getApiErrorStatus: jest.fn(() => null),
}));

const corrigirCategoria = applyReview as jest.MockedFunction<typeof applyReview>;
const marcarPropria = setInternalTransfer as jest.MockedFunction<
  typeof setInternalTransfer
>;
const marcarCasa = setFamilyTransfer as jest.MockedFunction<
  typeof setFamilyTransfer
>;
const marcarIgnorada = setTransactionIgnored as jest.MockedFunction<
  typeof setTransactionIgnored
>;

// O seletor vira um botao: o que importa aqui e a GRAVACAO, e a folha de
// categorias tem suite propria
jest.mock("../CategoryPickerSheet", () => {
  const { Text, TouchableOpacity } = require("react-native");
  const ReactLocal = require("react");
  return {
    __esModule: true,
    default: ({ visible, onSelect }: { visible: boolean; onSelect: (c: { id: string }) => void }) =>
      visible
        ? ReactLocal.createElement(
            TouchableOpacity,
            {
              accessibilityLabel: "escolher Transporte",
              onPress: () => onSelect({ id: "cat-2" }),
            },
            ReactLocal.createElement(Text, null, "Transporte"),
          )
        : null,
  };
});

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ index: 0, routes: [{ name: "Extrato" }] }),
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

const CATEGORIA: { id: string; name: string } = {
  id: "cat-1",
  name: "Mercado",
};

const LANCAMENTO = {
  id: "t1",
  transactionId: "ext-t1",
  type: "DEBIT",
  amount: -194.99,
  description: "SUPERMERCADO SERO",
  originalDescription: "Pagamento com QR Pix SUPERMERCADOS SEROPEDICA LTDA",
  date: "2026-08-01T12:00:00Z",
  categoryId: null,
  category: null,
  accountId: null,
  reviewStatus: "CONFIRMED",
  categorizedBy: "USER",
  confidence: null,
  internalTransfer: false,
  ignored: false,
  familyTransfer: false,
  refunded: false,
  refundOfId: null,
} as unknown as BankTransaction;

const montar = (
  visivel = true,
  onUpdated = jest.fn(),
  ajustes: Partial<BankTransaction> = {},
) =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <TransactionDetailSheet
        transaction={{ ...LANCAMENTO, ...ajustes }}
        visible={visivel}
        onClose={jest.fn()}
        onUpdated={onUpdated}
      />
    </SafeAreaProvider>,
  );

describe("Detalhe da transação", () => {
  beforeEach(() => {
    useCategoriesStore.setState({
      items: [CATEGORIA as never],
      byId: (id: string) => (id === CATEGORIA.id ? (CATEGORIA as never) : undefined),
    } as never);
    useAccountsStore.setState({
      accounts: [],
      byId: new Map(),
    } as never);
    useFamilyStore.setState({ hasFamily: false } as never);
    marcarPropria.mockReset();
    marcarCasa.mockReset();
    marcarIgnorada.mockReset();
  });

  it("mostra a descrição do lançamento", async () => {
    const { getByText } = montar();

    await waitFor(() => expect(getByText("SUPERMERCADO SERO")).toBeTruthy());
  });

  it("fechada, não desenha o conteúdo", async () => {
    const { queryByText } = montar(false);

    await waitFor(() => expect(queryByText("SUPERMERCADO SERO")).toBeNull());
  });

  it("marcar como dinheiro meu grava e devolve a linha à tela", async () => {
    const onUpdated = jest.fn();
    marcarPropria.mockResolvedValue({
      ...LANCAMENTO,
      internalTransfer: true,
    } as BankTransaction);
    const { getByLabelText } = montar(true, onUpdated);

    fireEvent(
      await waitFor(() => getByLabelText("É dinheiro meu trocando de bolso")),
      "valueChange",
      true,
    );

    await waitFor(() => expect(marcarPropria).toHaveBeenCalledWith("t1", true));
    expect(onUpdated).toHaveBeenCalled();
  });

  it("linha estornada diz por que já está fora das somas", async () => {
    // a marca de estorno é automática e não tem interruptor: sem uma frase, a
    // linha simplesmente some das somas sem explicação nenhuma
    const { getByText } = montar(true, undefined, { refunded: true });

    await waitFor(() =>
      expect(getByText(/faz par com um estorno de mesmo valor/)).toBeTruthy(),
    );
  });

  it("sem estorno, a frase do estorno não aparece", async () => {
    const { queryByText } = montar(true);

    await waitFor(() =>
      expect(queryByText(/faz par com um estorno de mesmo valor/)).toBeNull(),
    );
  });

  it("a categoria é um botão: dá para corrigir de onde o número aparece", async () => {
    // EC-198: quem desconfia de um número está olhando para ele. Mandar
    // procurar a mesma linha na Revisão para corrigir é pedir que desista
    const { getByLabelText } = montar(true, undefined, {
      categoryId: CATEGORIA.id,
    });

    await waitFor(() =>
      expect(
        getByLabelText(`Categoria ${CATEGORIA.name}. Toque para trocar`),
      ).toBeTruthy(),
    );
  });

  it("sem categoria, o botão convida a escolher uma", async () => {
    const { getByLabelText } = montar(true, undefined, { categoryId: null });

    await waitFor(() =>
      expect(getByLabelText("Sem categoria. Toque para escolher")).toBeTruthy(),
    );
  });

  it("escolher outra categoria grava pela MESMA porta da Revisão, ensinando o motor", async () => {
    // learnPattern ligado: corrigir uma linha ensina o motor, e ensinar de um
    // lugar e não do outro faria a mesma correção valer diferente conforme a
    // tela em que ela foi feita
    corrigirCategoria.mockResolvedValue({ updated: 1 } as never);
    const onUpdated = jest.fn();
    const { getByLabelText } = montar(true, onUpdated, { categoryId: CATEGORIA.id });

    fireEvent.press(
      await waitFor(() =>
        getByLabelText(`Categoria ${CATEGORIA.name}. Toque para trocar`),
      ),
    );
    fireEvent.press(await waitFor(() => getByLabelText("escolher Transporte")));

    await waitFor(() =>
      expect(corrigirCategoria).toHaveBeenCalledWith([
        { transactionIds: ["t1"], categoryId: "cat-2", learnPattern: true },
      ]),
    );
    // a linha volta para a tela com a categoria nova, sem recarregar tudo
    await waitFor(() =>
      expect(onUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: "cat-2", reviewStatus: "CONFIRMED" }),
      ),
    );
  });

  it("escolher a MESMA categoria não gasta uma requisição", async () => {
    corrigirCategoria.mockClear();
    // "cat-2" não está no store local, então a linha diz "Sem categoria" — o
    // que importa aqui é que o id JÁ é o escolhido
    const { getByLabelText } = montar(true, undefined, { categoryId: "cat-2" });

    fireEvent.press(
      await waitFor(() => getByLabelText(/Toque para (trocar|escolher)/)),
    );
    fireEvent.press(await waitFor(() => getByLabelText("escolher Transporte")));

    expect(corrigirCategoria).not.toHaveBeenCalled();
  });

  it("falha ao trocar categoria aparece NA folha", async () => {
    // Toast é montado fora do Modal e pode não aparecer por cima dele; falha
    // silenciosa seria a tela afirmando uma correção que não aconteceu
    corrigirCategoria.mockRejectedValue(new Error("boom"));
    const { getByLabelText, getByText } = montar(true, undefined, {
      categoryId: CATEGORIA.id,
    });

    fireEvent.press(
      await waitFor(() => getByLabelText(/Toque para trocar/)),
    );
    fireEvent.press(await waitFor(() => getByLabelText("escolher Transporte")));

    await waitFor(() =>
      expect(getByText("Não foi possível trocar a categoria agora.")).toBeTruthy(),
    );
  });

  it("sem casa, o interruptor da casa não existe", async () => {
    const { queryByLabelText } = montar();

    // um controle sem efeito é pior que controle nenhum: sem família a marca
    // não muda soma alguma
    await waitFor(() => expect(queryByLabelText("Ficou dentro da casa")).toBeNull());
  });

  it("com casa, dá para dizer que o dinheiro ficou entre vocês", async () => {
    useFamilyStore.setState({ hasFamily: true } as never);
    marcarCasa.mockResolvedValue({
      ...LANCAMENTO,
      familyTransfer: true,
    } as BankTransaction);
    const { getByLabelText } = montar();

    fireEvent(
      await waitFor(() => getByLabelText("Ficou dentro da casa")),
      "valueChange",
      true,
    );

    await waitFor(() => expect(marcarCasa).toHaveBeenCalledWith("t1", true));
  });

  it("descartar a linha não a apaga, só a marca", async () => {
    marcarIgnorada.mockResolvedValue({
      ...LANCAMENTO,
      ignored: true,
    } as BankTransaction);
    const { getByLabelText } = montar();

    fireEvent(
      await waitFor(() => getByLabelText("Esta linha não deveria existir")),
      "valueChange",
      true,
    );

    await waitFor(() => expect(marcarIgnorada).toHaveBeenCalledWith("t1", true));
  });

  it("falha ao marcar aparece NA folha", async () => {
    marcarPropria.mockRejectedValue(new Error("boom"));
    const { getByLabelText, findByText } = montar();

    fireEvent(
      await waitFor(() => getByLabelText("É dinheiro meu trocando de bolso")),
      "valueChange",
      true,
    );

    expect(
      await findByText("Não consegui mudar isso agora. Tente de novo."),
    ).toBeTruthy();
  });
});
