import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import TransactionRow from "../TransactionRow";
import type {
  BankTransaction,
  Category,
  ConnectorAccount,
} from "../../services/api";
import { formatBRL } from "../../utils/money";

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
    accountId: null,
    internalTransfer: false,
    ignored: false,
    familyTransfer: false,
    refunded: false,
    refundOfId: null,
    ...overrides,
  };
}

/** Como os testes de tela montam a linha: sem os campos opcionais. */
const minima = {
  id: "t-min",
  type: "DEBIT",
  amount: -194.99,
  description: "SUPERMERCADO SERO",
  date: "2026-08-10T12:00:00Z",
  categoryId: null,
  accountId: null,
  reviewStatus: "CONFIRMED",
} as unknown as BankTransaction;

const alimentacao: Category = {
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
};

const cartao: ConnectorAccount = {
  id: "acc-cartao",
  name: "Ultravioleta ····1234",
  type: "CREDIT_CARD",
  institution: "Nubank",
  statementClosingDay: 10,
  statementDueDay: 17,
  linked: true,
  reportedBalance: null,
  reportedBalanceAt: null,
  creditLimit: null,
  creditLimitSharedWith: null,
};

const linha = () => /Abrir detalhes e apelido/;

describe("TransactionRow", () => {
  it("a fixture mínima desenha nome, valor, data e a falta de categoria", () => {
    const tela = render(<TransactionRow transaction={minima} onPress={jest.fn()} />);

    expect(tela.getByText("SUPERMERCADO SERO")).toBeTruthy();
    expect(tela.getByText(`- ${formatBRL(194.99)}`)).toBeTruthy();
    expect(tela.getByText("10 ago")).toBeTruthy();
    // Resposta escrita, não um buraco onde a categoria ficaria
    expect(tela.getByText("Sem categoria")).toBeTruthy();
  });

  it("o toque devolve a transação inteira e a linha é um botão", () => {
    const onPress = jest.fn();
    const tela = render(
      <TransactionRow transaction={tx()} category={alimentacao} onPress={onPress} />,
    );

    fireEvent.press(tela.getByText("IFOOD"));

    expect(onPress).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));
    expect(tela.getByLabelText(linha()).props.accessibilityRole).toBe("button");
  });

  it("sem onPress a linha vira texto, e não promete abrir nada", () => {
    // Linha de outra pessoa na casa: o dado é dela, e oferecer o toque seria
    // prometer o que o servidor recusaria
    const tela = render(<TransactionRow transaction={tx()} />);

    const no = tela.getByLabelText(/IFOOD/);
    expect(no.props.accessibilityRole).toBe("text");
    expect(no.props.accessibilityLabel).not.toContain("Abrir detalhes");
  });

  it("débito é neutro (mesma cor do título); crédito sobe e ganha o mais", () => {
    const debito = render(<TransactionRow transaction={tx()} onPress={jest.fn()} />);
    expect(debito.getByText(`- ${formatBRL(89.9)}`).props.style.color).toBe(
      debito.getByText("IFOOD").props.style.color,
    );

    const credito = render(
      <TransactionRow
        transaction={tx({ type: "CREDIT", amount: 1200, description: "SALARIO" })}
        onPress={jest.fn()}
      />,
    );
    const valor = credito.getByText(`+ ${formatBRL(1200)}`);
    expect(valor.props.style.color).not.toBe(
      credito.getByText("SALARIO").props.style.color,
    );
  });

  it("renomeada mostra o apelido, o texto do banco e fala os dois", () => {
    const tela = render(
      <TransactionRow transaction={tx({ displayAlias: "Delivery" })} onPress={jest.fn()} />,
    );

    expect(tela.getByText("Delivery")).toBeTruthy();
    expect(tela.getByText("No banco: IFOOD *REST")).toBeTruthy();
    expect(tela.getByLabelText(/Delivery, no banco: IFOOD \*REST/)).toBeTruthy();
  });

  it("categoria e data são nós de texto próprios na linha de apoio", () => {
    const tela = render(
      <TransactionRow transaction={tx()} category={alimentacao} onPress={jest.fn()} />,
    );

    expect(tela.getByText("Alimentação")).toBeTruthy();
    expect(tela.getByText("28 jul")).toBeTruthy();
  });

  it("showCategory=false tira a categoria da linha (ela mora no contêiner)", () => {
    const tela = render(
      <TransactionRow
        transaction={tx()}
        category={alimentacao}
        showCategory={false}
        onPress={jest.fn()}
      />,
    );

    expect(tela.queryByText("Alimentação")).toBeNull();
    expect(tela.queryByText("Sem categoria")).toBeNull();
    expect(tela.getByText("28 jul")).toBeTruthy();
  });

  it("pendente ganha o selo Revisar e a linha fala 'aguardando revisão'", () => {
    const tela = render(
      <TransactionRow transaction={tx({ reviewStatus: "SUGGESTED" })} onPress={jest.fn()} />,
    );

    expect(tela.getByText("Revisar")).toBeTruthy();
    expect(tela.getByLabelText(/IFOOD.*aguardando revisão/)).toBeTruthy();
  });

  it("as marcas de 'como esta linha conta' viram selos e rebaixam o valor", () => {
    const tela = render(
      <TransactionRow
        transaction={tx({
          ignored: true,
          internalTransfer: true,
          familyTransfer: true,
          refunded: true,
        })}
        onPress={jest.fn()}
      />,
    );

    expect(tela.getByText("Ignorada")).toBeTruthy();
    expect(tela.getByText("Entre contas")).toBeTruthy();
    expect(tela.getByText("Na casa")).toBeTruthy();
    expect(tela.getByText("Estornada")).toBeTruthy();
    // O valor que não conta nas somas não veste a cor do título nem vermelho
    expect(tela.getByText(`- ${formatBRL(89.9)}`).props.style.color).not.toBe(
      tela.getByText("IFOOD").props.style.color,
    );
  });

  it("conta resolvida vai para a linha de apoio; sem conta a origem vira selo", () => {
    const comConta = render(
      <TransactionRow
        transaction={tx({ accountId: cartao.id })}
        account={cartao}
        showOrigin
        onPress={jest.fn()}
      />,
    );
    expect(comConta.getByText("Ultravioleta ····1234")).toBeTruthy();
    expect(comConta.queryByText("Origem não informada")).toBeNull();

    const semConta = render(
      <TransactionRow transaction={tx()} showOrigin onPress={jest.fn()} />,
    );
    expect(semConta.getByText("Origem não informada")).toBeTruthy();
  });

  it("na casa, a linha nomeia o dono", () => {
    const tela = render(
      <TransactionRow
        transaction={tx()}
        member={{ memberId: "m1", memberName: "Ana", isMe: false }}
      />,
    );

    expect(tela.getByLabelText("Lançamento de Ana")).toBeTruthy();
    expect(tela.getByLabelText(/IFOOD.*lançamento de Ana/)).toBeTruthy();
  });

  it("a voz do cartão fala compra — por prop ou pela conta resolvida", () => {
    const porProp = render(
      <TransactionRow transaction={tx()} voice="card" onPress={jest.fn()} />,
    );
    expect(porProp.getByLabelText(/compra de/)).toBeTruthy();

    const pelaConta = render(
      <TransactionRow
        transaction={tx({ accountId: cartao.id })}
        account={cartao}
        onPress={jest.fn()}
      />,
    );
    expect(pelaConta.getByLabelText(/compra de/)).toBeTruthy();
  });

  it("a densidade card desenha a mesma linha, sem selo quando não há o que marcar", () => {
    const tela = render(
      <TransactionRow
        transaction={tx()}
        category={alimentacao}
        density="card"
        onPress={jest.fn()}
      />,
    );

    expect(tela.getByText("IFOOD")).toBeTruthy();
    expect(tela.queryByText("Revisar")).toBeNull();
  });
});
