import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import InvoiceReserveSheet from "../InvoiceReserveSheet";
import type { AccountInvoice, ConnectorAccount } from "../../services/api";
import { deleteInvoiceReserve, saveInvoiceReserve } from "../../services/api";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  saveInvoiceReserve: jest.fn(),
  deleteInvoiceReserve: jest.fn(),
}));

const guardar = saveInvoiceReserve as jest.MockedFunction<typeof saveInvoiceReserve>;
const apagar = deleteInvoiceReserve as jest.MockedFunction<typeof deleteInvoiceReserve>;

const FATURA: AccountInvoice = {
  reference: "2026-09",
  periodStart: "2026-08-09",
  periodEnd: "2026-09-08",
  closingDate: "2026-09-08",
  dueDate: "2026-09-14",
  total: 641.14,
  purchasesTotal: 641.14,
  refundsTotal: 0,
  paymentsTotal: 0,
  transactionCount: 2,
  open: false,
  reserve: null,
  transactions: [],
};

const CONTA: ConnectorAccount = {
  id: "acc-mp",
  name: "Mercado Pago ····7340",
  type: "BANK",
  institution: "Mercado Pago",
  statementClosingDay: null,
  statementDueDay: null,
  linked: true,
};

const CARTAO: ConnectorAccount = {
  ...CONTA,
  id: "acc-card",
  name: "Mercado Livre ····9012",
  type: "CREDIT_CARD",
};

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = (invoice: AccountInvoice = FATURA, onSaved = jest.fn()) =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <InvoiceReserveSheet
        visible
        invoice={invoice}
        cardAccountId="acc-card"
        accounts={[CONTA, CARTAO]}
        onClose={jest.fn()}
        onSaved={onSaved}
      />
    </SafeAreaProvider>,
  );

describe("InvoiceReserveSheet", () => {
  beforeEach(() => {
    guardar.mockReset();
    apagar.mockReset();
  });

  it("abre proposta com o valor exato da fatura", async () => {
    const { getByLabelText } = montar();

    // "separei o valor exato" é o caso comum: quem quer isso só confirma
    await waitFor(() =>
      expect(getByLabelText("Valor separado").props.value).toBe("641,14"),
    );
  });

  it("guarda o valor com a conta que segura o dinheiro", async () => {
    const onSaved = jest.fn();
    const { getByLabelText } = montar(FATURA, onSaved);

    fireEvent.press(getByLabelText("Mercado Pago ····7340"));
    fireEvent.press(getByLabelText("Guardar o valor separado"));

    await waitFor(() =>
      expect(guardar).toHaveBeenCalledWith("acc-card", "2026-09", {
        amount: 641.14,
        heldInAccountId: "acc-mp",
        note: null,
      }),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it("cartão não aparece como lugar onde o dinheiro está parado", () => {
    const { queryByLabelText } = montar();

    // reservar "no próprio cartão" o valor da fatura dele não quer dizer nada
    expect(queryByLabelText("Mercado Livre ····9012")).toBeNull();
  });

  it("valor zerado não vai para o servidor", async () => {
    const { getByLabelText, findByText } = montar();

    fireEvent.changeText(getByLabelText("Valor separado"), "0");
    fireEvent.press(getByLabelText("Guardar o valor separado"));

    expect(await findByText("O valor separado precisa ser maior que zero.")).toBeTruthy();
    expect(guardar).not.toHaveBeenCalled();
  });

  it("campo vazio pede o valor em vez de mandar nada", async () => {
    const { getByLabelText, findByText } = montar();

    fireEvent.changeText(getByLabelText("Valor separado"), "");
    fireEvent.press(getByLabelText("Guardar o valor separado"));

    expect(await findByText("Informe quanto você separou.")).toBeTruthy();
    expect(guardar).not.toHaveBeenCalled();
  });

  it("com reserva salva, oferece desfazer", async () => {
    const onSaved = jest.fn();
    const comReserva: AccountInvoice = {
      ...FATURA,
      reserve: {
        id: "r1",
        amount: 641.14,
        heldInAccountId: "acc-mp",
        heldInAccountName: "Mercado Pago ····7340",
        note: "deixei separado",
      },
    };
    const { getByLabelText } = montar(comReserva, onSaved);

    fireEvent.press(getByLabelText("Desfazer a reserva desta fatura"));

    await waitFor(() => expect(apagar).toHaveBeenCalledWith("acc-card", "2026-09"));
    expect(onSaved).toHaveBeenCalled();
  });

  it("sem reserva salva não há o que desfazer", () => {
    const { queryByLabelText } = montar();

    expect(queryByLabelText("Desfazer a reserva desta fatura")).toBeNull();
  });

  it("falha ao guardar fica NA folha, e não some num toast atrás do modal", async () => {
    guardar.mockRejectedValue(new Error("boom"));
    const { getByLabelText, findByText } = montar();

    fireEvent.press(getByLabelText("Guardar o valor separado"));

    expect(await findByText("Não consegui guardar agora. Tente de novo.")).toBeTruthy();
  });
});
