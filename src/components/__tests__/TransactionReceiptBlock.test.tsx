import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import TransactionReceiptBlock from "../TransactionReceiptBlock";
import type { BankTransaction } from "../../services/api";
import type { ShoppingTrip } from "../../utils/shopping";

jest.mock("expo-camera", () => ({
  CameraView: () => null,
  useCameraPermissions: () => [
    { granted: false },
    jest.fn().mockResolvedValue({ granted: false }),
  ],
}));

const loja = {
  trips: [] as ShoppingTrip[],
  reconcile: jest.fn(async () => ({ ok: true, message: "Compra conciliada com o extrato." })),
  attachReceiptToTransaction: jest.fn(async () => ({
    ok: true,
    clientId: "nova",
    message: "ok",
  })),
  closeTrip: jest.fn(async () => {}),
};

jest.mock("../../store/shoppingStore", () => ({
  useShoppingStore: (seletor: (estado: unknown) => unknown) =>
    seletor(jest.requireMock("../../store/shoppingStore").__loja),
  __loja: undefined,
}));

// O mock acima lê `__loja` no momento da chamada; aqui ele ganha o objeto
(jest.requireMock("../../store/shoppingStore") as { __loja: unknown }).__loja = loja;

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Cupom de SP, 09/2026, CNPJ 12.345.678/0001-95, nº 123456. */
const CHAVE = "35260912345678000195650010001234561123456788";

const LANCAMENTO: BankTransaction = {
  id: "tx-600",
  transactionId: "FITID-600",
  type: "DEBIT",
  amount: -600,
  description: "FLASH APP",
  originalDescription: "FLASH APP",
  displayAlias: null,
  date: "2026-09-20T12:00:00.000Z",
  categoryId: null,
  reviewStatus: "CONFIRMED",
  categorizedBy: null,
  confidence: null,
  normalizedDescription: null,
  uploadId: null,
  accountId: null,
  internalTransfer: false,
  ignored: false,
} as BankTransaction;

const compra = (over: Partial<ShoppingTrip> = {}): ShoppingTrip => ({
  clientId: "c1",
  storeName: "Flash",
  status: "CLOSED",
  budget: null,
  startedAt: "2026-09-20T11:00:00.000Z",
  closedAt: "2026-09-20T12:00:00.000Z",
  receiptTotal: 600,
  receiptKey: null,
  receiptIssuerCnpj: null,
  notes: null,
  shareWithFamily: false,
  items: [],
  clientUpdatedAt: "2026-09-20T12:00:00.000Z",
  dirty: false,
  mine: true,
  ownerName: null,
  transactionId: null,
  ...over,
});

function montar(over: Partial<React.ComponentProps<typeof TransactionReceiptBlock>> = {}) {
  const onOpenTrip = jest.fn();
  const tela = render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <TransactionReceiptBlock
        transaction={LANCAMENTO}
        onOpenTrip={onOpenTrip}
        {...over}
      />
    </SafeAreaProvider>,
  );
  return { tela, onOpenTrip };
}

/** Lê o QR pelo caminho de digitar a chave, que é o que o teste alcança. */
async function lerANota(tela: ReturnType<typeof render>) {
  fireEvent.press(tela.getByLabelText("Ler o QR da nota fiscal"));
  fireEvent.changeText(tela.getByLabelText("Chave da nota fiscal"), CHAVE);
  fireEvent.press(tela.getByLabelText("Usar a chave digitada"));
  await waitFor(() => expect(tela.getByLabelText("Anexar esta nota à compra")).toBeTruthy());
  fireEvent.press(tela.getByLabelText("Anexar esta nota à compra"));
}

describe("TransactionReceiptBlock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loja.trips = [];
  });

  it("sem compra ligada, a nota cria a compra a partir do próprio lançamento", async () => {
    // O caso do dono: a compra de R$ 600 do Flash já tinha sido paga, e não
    // havia carrinho nenhum para fechar
    const { tela } = montar();

    await lerANota(tela);

    await waitFor(() =>
      expect(loja.attachReceiptToTransaction).toHaveBeenCalledWith({
        transactionId: "tx-600",
        storeName: "FLASH APP",
        amount: -600,
        date: "2026-09-20T12:00:00.000Z",
        receiptKey: CHAVE,
      }),
    );
  });

  it("oferece as compras já anotadas que podem ser este lançamento", () => {
    loja.trips = [compra({ clientId: "c1", storeName: "Flash", receiptTotal: 600 })];
    const { tela } = montar();

    fireEvent.press(tela.getByLabelText(/^Ligar a Flash/));
    expect(loja.reconcile).toHaveBeenCalledWith("c1", "tx-600");
  });

  it("compra de outra pessoa não é oferecida", () => {
    loja.trips = [compra({ clientId: "da-alice", mine: false })];
    const { tela } = montar();
    expect(tela.queryByLabelText(/^Ligar a/)).toBeNull();
  });

  it("com a compra ligada, a folha mostra a compra e leva até ela", () => {
    loja.trips = [compra({ transactionId: "tx-600", items: [] })];
    const { tela, onOpenTrip } = montar();

    fireEvent.press(tela.getByLabelText(/^Abrir a compra Flash/));
    expect(onOpenTrip).toHaveBeenCalledWith("c1");
  });

  it("com a nota já anexada, a folha diz o que ela é", () => {
    loja.trips = [compra({ transactionId: "tx-600", receiptKey: CHAVE })];
    const { tela } = montar();

    expect(tela.getByText(/Cupom nº 123456/)).toBeTruthy();
    expect(tela.getByLabelText("Trocar a nota fiscal desta compra")).toBeTruthy();
  });

  it("na compra já ligada, ler outra nota troca a chave sem criar compra nova", async () => {
    loja.trips = [compra({ transactionId: "tx-600" })];
    const { tela } = montar();

    fireEvent.press(tela.getByLabelText("Ler o QR da nota fiscal"));
    fireEvent.changeText(tela.getByLabelText("Chave da nota fiscal"), CHAVE);
    fireEvent.press(tela.getByLabelText("Usar a chave digitada"));
    await waitFor(() => expect(tela.getByLabelText("Anexar esta nota à compra")).toBeTruthy());
    fireEvent.press(tela.getByLabelText("Anexar esta nota à compra"));

    await waitFor(() => expect(loja.closeTrip).toHaveBeenCalledWith("c1", 600, CHAVE));
    expect(loja.attachReceiptToTransaction).not.toHaveBeenCalled();
  });
});
