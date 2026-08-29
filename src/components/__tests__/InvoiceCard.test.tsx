import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import InvoiceCard from "../InvoiceCard";
import type {
  AccountInvoice,
  BankTransaction,
  Category,
} from "../../services/api";

function tx(overrides: Partial<BankTransaction> = {}): BankTransaction {
  return {
    id: "t1",
    transactionId: "bank-1",
    type: "DEBIT",
    amount: -89.9,
    description: "IFOOD",
    originalDescription: "IFOOD *REST",
    displayAlias: null,
    date: "2026-07-28T00:00:00Z",
    categoryId: "cat-food",
    reviewStatus: "CONFIRMED",
    categorizedBy: "KEYWORD",
    confidence: 0.9,
    normalizedDescription: "ifood rest",
    uploadId: null,
    accountId: "acc-cartao",
    ...overrides,
  };
}

function invoice(overrides: Partial<AccountInvoice> = {}): AccountInvoice {
  return {
    reference: "2026-08",
    periodStart: "2026-07-11",
    periodEnd: "2026-08-10",
    closingDate: "2026-08-10",
    dueDate: "2026-08-17",
    total: 1234.56,
    purchasesTotal: 1500,
    refundsTotal: 265.44,
    paymentsTotal: 900,
    transactionCount: 1,
    open: false,
    transactions: [tx()],
    ...overrides,
  };
}

const categories = new Map<string, Category>([
  [
    "cat-food",
    {
      id: "cat-food",
      name: "Alimentação",
      slug: "alimentacao",
      groupName: null,
      flow: "EXPENSE",
      color: null,
      icon: "utensils",
      systemKey: "FOOD",
      parentId: null,
      parentName: null,
      parentSystemKey: null,
      system: true,
      archived: false,
    },
  ],
]);

function renderCard(props: Partial<React.ComponentProps<typeof InvoiceCard>> = {}) {
  const onToggle = jest.fn();
  const onOpenTransaction = jest.fn();
  const tela = render(
    <InvoiceCard
      invoice={invoice()}
      approximate={false}
      expanded={false}
      onToggle={onToggle}
      onOpenTransaction={onOpenTransaction}
      categories={categories}
      {...props}
    />,
  );
  return { tela, onToggle, onOpenTransaction };
}

describe("InvoiceCard", () => {
  it("mostra o valor devido por extenso, sem abreviar", () => {
    // Superfície de conferência: o usuário compara este número com o app do
    // banco, e "R$ 123,4 mil" apaga justamente o que ele foi conferir
    const { tela } = renderCard({
      invoice: invoice({ total: 123456.78, purchasesTotal: 123456.78, refundsTotal: 0, paymentsTotal: 0 }),
    });
    // Aparece duas vezes (o total e a linha de compras) e nas duas por
    // extenso: nenhuma superfície de conferência abrevia
    expect(tela.getAllByText("R$ 123.456,78")).toHaveLength(2);
    expect(tela.queryByText(/mil/)).toBeNull();
  });

  it("declara o pagamento como fora do total", () => {
    const { tela } = renderCard();
    expect(tela.getByText("Pagamentos")).toBeTruthy();
    expect(tela.getByText("não entra no total")).toBeTruthy();
  });

  it("some com estorno e pagamento zerados", () => {
    const { tela } = renderCard({
      invoice: invoice({ refundsTotal: 0, paymentsTotal: 0 }),
    });
    expect(tela.queryByText("Estornos")).toBeNull();
    expect(tela.queryByText("Pagamentos")).toBeNull();
    expect(tela.getByText("Compras")).toBeTruthy();
  });

  it("fatura fechada mostra o total e o vencimento", () => {
    const { tela } = renderCard();
    expect(tela.getByText("TOTAL")).toBeTruthy();
    expect(tela.getByText(/Vence em 17\/08/)).toBeTruthy();
    expect(tela.getByText("Fechada")).toBeTruthy();
  });

  it("estorno maior que compras vira CRÉDITO, não TOTAL", () => {
    // Total negativo é caso legítimo do contrato: o usuário não deve nada,
    // tem a receber. "TOTAL −R$ 200,00" em cor neutra lê como dívida
    const { tela } = renderCard({
      invoice: invoice({
        total: -200,
        purchasesTotal: 100,
        refundsTotal: 300,
        paymentsTotal: 0,
      }),
    });
    expect(tela.getByText("CRÉDITO")).toBeTruthy();
    expect(tela.queryByText("TOTAL")).toBeNull();
    // O valor continua com o sinal do servidor: é o que ele compara com o banco
    expect(tela.getByText("-R$ 200,00")).toBeTruthy();
    expect(
      tela.getByLabelText(/crédito de R\$\s?200,00 a seu favor/),
    ).toBeTruthy();
  });

  it("fatura só de pagamento mostra zero devido e o pagamento fora do total", () => {
    const { tela } = renderCard({
      invoice: invoice({
        total: 0,
        purchasesTotal: 0,
        refundsTotal: 0,
        paymentsTotal: 900,
      }),
    });
    expect(tela.getByText("TOTAL")).toBeTruthy();
    expect(tela.getByText("R$ 900,00")).toBeTruthy();
    expect(tela.getByText("não entra no total")).toBeTruthy();
    // O 900 não pode virar o número que o usuário deve
    expect(tela.getAllByText("R$ 0,00").length).toBeGreaterThan(0);
  });

  it("fatura em aberto se anuncia como parcial e diz quando fecha", () => {
    const { tela } = renderCard({ invoice: invoice({ open: true }) });
    expect(tela.getByText("PARCIAL")).toBeTruthy();
    expect(tela.getByText("Em aberto")).toBeTruthy();
    expect(tela.getByText(/Fecha em 10\/08/)).toBeTruthy();
    expect(
      tela.getByLabelText(/em aberto, parcial de R\$\s?1\.234,56/),
    ).toBeTruthy();
  });

  it("avisa no período quando o corte foi derivado pela API", () => {
    // `cycleSource=CALENDAR_MONTH`: o banco não informou o fechamento e a
    // borda do período é um palpite — fingir precisão aqui é o pior erro
    const { tela } = renderCard({ approximate: true });
    expect(tela.getByText("11/07 → 10/08 (aproximado)")).toBeTruthy();
  });

  it("sem o aviso quando o fechamento é o real do banco", () => {
    const { tela } = renderCard();
    expect(tela.getByText("11/07 → 10/08")).toBeTruthy();
  });

  it("fechada some, aberta abre: o toque no cabeçalho alterna", () => {
    const { tela, onToggle } = renderCard();
    fireEvent.press(tela.getByLabelText(/Fatura de agosto de 2026/));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("expandida lista o lançamento com categoria e abre o detalhe", () => {
    // É o pedido do dono em uma linha: cada coisa feita no cartão precisa
    // aparecer identificada E categorizada
    const { tela, onOpenTransaction } = renderCard({ expanded: true });
    expect(tela.getByText("IFOOD")).toBeTruthy();
    expect(tela.getByText("Alimentação")).toBeTruthy();
    fireEvent.press(tela.getByText("IFOOD"));
    expect(onOpenTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1" }),
    );
  });

  it("compra sem categoria continua legível e marcada para revisão", () => {
    const { tela } = renderCard({
      expanded: true,
      invoice: invoice({
        transactions: [
          tx({ categoryId: null, reviewStatus: "UNCATEGORIZED" }),
        ],
      }),
    });
    expect(tela.getByText("Sem categoria · revisar")).toBeTruthy();
  });

  it("fatura que veio sem os lançamentos diz isso, em vez de parecer vazia", () => {
    const { tela } = renderCard({
      expanded: true,
      invoice: invoice({ transactions: [] }),
    });
    expect(tela.getByText("Esta fatura não trouxe os lançamentos.")).toBeTruthy();
  });
});
