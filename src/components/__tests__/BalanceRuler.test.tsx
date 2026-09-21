import React from "react";
import { render } from "@testing-library/react-native";

import BalanceRuler from "../BalanceRuler";
import {
  contratados,
  montarRegua,
  somasContratadas,
  tresCenarios,
} from "../../utils/balanceRuler";
import type { ForecastItem } from "../../services/api";

const item = (over: Partial<ForecastItem>): ForecastItem =>
  ({
    seriesId: "s1",
    displayName: "Aluguel",
    flow: "EXPENSE",
    dueDay: null,
    dueDate: null,
    amount: 100,
    source: "RECURRENCE",
    settled: false,
    ...over,
  }) as ForecastItem;

const HOJE = "2026-09-17";

function montar(over: {
  saldoInicial?: number;
  itens?: ForecastItem[];
  despesaMedia?: number | null;
  despesaPiorMes?: number | null;
}) {
  const regua = montarRegua({
    saldoInicial: over.saldoInicial ?? 1000,
    itens: over.itens ?? [
      item({
        seriesId: "sal",
        flow: "INCOME",
        amount: 4820,
        dueDate: "2026-09-20",
      }),
      item({ seriesId: "alu", amount: 1500, dueDate: "2026-09-25" }),
    ],
    hoje: HOJE,
  });
  const somas = somasContratadas(regua);
  return render(
    <BalanceRuler
      regua={regua}
      contratados={contratados(regua)}
      cenarios={tresCenarios({
        saldoInicial: regua.saldoInicial,
        receitaContratada: somas.receita,
        despesaContratada: somas.despesa,
        despesaMedia: over.despesaMedia ?? null,
        despesaPiorMes: over.despesaPiorMes ?? null,
      })}
    />,
  );
}

describe("BalanceRuler", () => {
  /**
   * A faixa é o ponto da escolha 9: a tela diz onde PARA de saber, em vez de
   * continuar desenhando meio ano de chute. Ela nomeia o último dia conhecido,
   * porque "não sei" sem data não ajuda ninguém a planejar.
   */
  it("a faixa diz onde o saber acaba, e em que data", () => {
    const { getByText } = montar({});

    expect(getByText(/Daqui para frente eu não sei/)).toBeTruthy();
    expect(getByText(/vence em 25 set/)).toBeTruthy();
  });

  it("sem nenhum compromisso datado, a faixa diz isso em vez de nomear um dia", () => {
    const { getByText } = montar({ itens: [] });

    expect(
      getByText(/não há nenhum compromisso com data nos próximos 30 dias/),
    ).toBeTruthy();
  });

  /**
   * O buraco no meio do mês é a razão de existir desta tela: dá para fechar o
   * mês com saldo positivo e furar o zero no dia 18, quando a fatura cai antes
   * do salário. Um número único de fim de mês esconde exatamente isso.
   */
  it("avisa o dia em que o saldo fura o zero", () => {
    const { getByText } = montar({
      saldoInicial: 300,
      itens: [
        item({ seriesId: "fat", amount: 900, dueDate: "2026-09-18" }),
        item({
          seriesId: "sal",
          flow: "INCOME",
          amount: 4820,
          dueDate: "2026-09-22",
        }),
      ],
    });

    expect(getByText(/O saldo fura o zero em 18 set/)).toBeTruthy();
  });

  it("sem furar o zero, não inventa aviso", () => {
    const { queryByText } = montar({});
    expect(queryByText(/fura o zero/)).toBeNull();
  });

  it("cada contratado mostra o que sobra depois dele", () => {
    const { getByText } = montar({});

    // 1000 + 4820 = 5820, e depois do aluguel sobram 4320
    expect(getByText("sobra R$ 5.820,00")).toBeTruthy();
    expect(getByText("sobra R$ 4.320,00")).toBeTruthy();
  });

  /**
   * O "folgado" não leva etiqueta de estimativa porque ele não estima nada: é
   * a soma do que está assinado. Os outros dois dizem que são estimativa, e de
   * onde saíram.
   */
  it("só os cenários que estimam se declaram estimativa", () => {
    const { getByText, queryByText } = montar({
      despesaMedia: 4200,
      despesaPiorMes: 5100,
    });

    expect(getByText("Folgado")).toBeTruthy();
    expect(getByText("Esperado · estimativa")).toBeTruthy();
    expect(getByText("Apertado · estimativa")).toBeTruthy();
    expect(queryByText("Folgado · estimativa")).toBeNull();
    expect(getByText("só o que está contratado")).toBeTruthy();
  });

  it("sem histórico de gasto, só o folgado aparece", () => {
    const { getByText, queryByText } = montar({});

    expect(getByText("Folgado")).toBeTruthy();
    expect(queryByText(/Esperado/)).toBeNull();
    expect(queryByText(/Apertado/)).toBeNull();
  });
});
