import React from "react";
import { render } from "@testing-library/react-native";

import StatementDayHeader from "../StatementDayHeader";
import { formatBRL } from "../../utils/money";

// Sem `ThemeProvider`: `useTheme` cai no tema padrão, e é assim que as outras
// suítes de componente montam. Envolver aqui puxava o
// `react-native-safe-area-context` pelo css-interop e estourava na montagem
const montar = (props: React.ComponentProps<typeof StatementDayHeader>) =>
  render(<StatementDayHeader {...props} />);

describe("StatementDayHeader", () => {
  it("diz o dia e o que o dia moveu", () => {
    const { getByText } = montar({
      rotulo: "Ontem",
      total: -86.8,
      saldoNoFim: 350,
    });

    expect(getByText("Ontem")).toBeTruthy();
    expect(getByText("- R$ 86,80")).toBeTruthy();
    expect(getByText("em conta R$ 350,00")).toBeTruthy();
  });

  it("dia de entrada leva sinal de mais", () => {
    const { getByText } = montar({
      rotulo: "05 set",
      total: 4820,
      saldoNoFim: null,
    });

    expect(getByText("+ R$ 4.820,00")).toBeTruthy();
  });

  /**
   * Sem saldo conhecido o cabeçalho mostra só o total, e não escreve nada no
   * lugar do saldo. Um "em conta R$ 0,00" ali seria uma afirmação falsa sobre
   * o dinheiro da pessoa — e é a classe de erro que fez a Previsão mostrar
   * -19 mil em 15/09.
   */
  it("sem saldo conhecido, não escreve saldo nenhum", () => {
    const { queryByText } = montar({
      rotulo: "Hoje",
      total: -10,
      saldoNoFim: null,
    });

    expect(queryByText(/em conta/)).toBeNull();
  });

  it("saldo zero é dito, porque zero é um saldo", () => {
    const { getByText } = montar({
      rotulo: "Hoje",
      total: -10,
      saldoNoFim: 0,
    });

    expect(getByText("em conta R$ 0,00")).toBeTruthy();
  });

  it("saldo negativo é dito como é", () => {
    const { getByText } = montar({
      rotulo: "12 ago",
      total: -200,
      saldoNoFim: -150,
    });

    // Sem suavizar: a conta estava negativa naquele dia
    expect(getByText("em conta -R$ 150,00")).toBeTruthy();
  });

  it("dia sem movimento líquido não é ganho nem perda", () => {
    const { getByText } = montar({ rotulo: "Hoje", total: 0, saldoNoFim: 100 });

    // Nem "+" nem "-": zero não tem direção
    expect(getByText("R$ 0,00")).toBeTruthy();
  });

  /**
   * Um anúncio só. Sem isto o leitor de tela diria "Ontem", "menos 86 reais" e
   * "em conta 350 reais" como três coisas sem relação entre si.
   */
  it("o leitor de tela ouve uma frase, não três pedaços", () => {
    const { getByRole } = montar({
      rotulo: "Ontem",
      total: -86.8,
      saldoNoFim: 350,
    });

    // A frase é montada com `formatBRL` e não escrita à mão: o formato de
    // pt-BR separa "R$" do número com espaço NÃO separável, e o `getByText`
    // normaliza espaços enquanto o `toBe` de um rótulo não — a diferença é
    // invisível na tela e na mensagem de erro
    const cabecalho = getByRole("header");
    expect(cabecalho.props.accessibilityLabel).toBe(
      `Ontem. Saiu ${formatBRL(86.8)} no dia. ` +
        `Em conta ao fim do dia, ${formatBRL(350)}`,
    );
  });

  it("sem saldo, a frase falada termina no total", () => {
    const { getByRole } = montar({
      rotulo: "Hoje",
      total: 120,
      saldoNoFim: null,
    });

    expect(getByRole("header").props.accessibilityLabel).toBe(
      `Hoje. Entrou ${formatBRL(120)} no dia`,
    );
  });
});
