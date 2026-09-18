import React from "react";
import { Text, View } from "react-native";

import { spacing } from "../theme/ds";
import { useTheme } from "../theme/ThemeProvider";
import { formatBRL } from "../utils/money";

/** Altura do cabeçalho. O esqueleto do extrato imita esta geometria. */
export const STATEMENT_DAY_HEADER_HEIGHT = 44;

interface Props {
  /** "Hoje", "Ontem" ou "15 set" — vem de `rotuloDoDia`. */
  rotulo: string;
  /** O que entrou menos o que saiu no dia. */
  total: number;
  /** Quanto havia em conta ao fim do dia, ou `null` quando não se sabe. */
  saldoNoFim: number | null;
}

/**
 * O CABEÇALHO DE UM DIA do extrato.
 *
 * <p>Escolha 8 do dono em 16/09/2026 (variante b, mais o que ele pediu da a):
 * <i>"a data sai da linha e vira um cabeçalho fixo por dia, com o total do dia
 * à direita"</i> e <i>"o cabeçalho do dia carrega também quanto havia em conta
 * naquele dia"</i>.
 *
 * <p><b>O que a tela ganhou.</b> A data era a terceira parte do texto de apoio
 * de TODA linha: vinte lançamentos do mesmo dia escreviam "16 set" vinte
 * vezes, e nenhum deles dizia quanto aquele dia custou. Agora a data é dita
 * uma vez, em cima, e o espaço que ela ocupava na linha virou o que estava
 * faltando — o total do dia e o saldo que sobrou.
 *
 * <p><b>Por que o saldo pode faltar.</b> `saldoNoFim` é `null` quando o app
 * não sabe: sem saldo de partida, com o filtro em "todas as origens" ou num
 * cartão. Nesse caso o cabeçalho mostra só o total e não escreve nada no lugar
 * do saldo. A regra inteira está em `podeMostrarSaldoCorrido`, e ela existe
 * porque somar o extrato como se fosse saldo é o defeito que o dono apontou na
 * Previsão em 15/09 (os -19 mil).
 *
 * <p>O fundo é opaco de propósito: como cabeçalho fixo, ele passa por cima das
 * linhas ao rolar, e com fundo transparente o texto se misturaria ao da linha
 * que está passando por baixo.
 */
export default function StatementDayHeader({
  rotulo,
  total,
  saldoNoFim,
}: Props) {
  const t = useTheme();
  // Zero é neutro: um dia sem movimento líquido não é ganho nem perda
  const tomDoTotal =
    total > 0 ? t.chart.up : total < 0 ? t.text.primary : t.text.tertiary;
  const sinal = total > 0 ? "+ " : total < 0 ? "- " : "";

  return (
    <View
      // Um anúncio só: sem isto o leitor de tela diria "Ontem", "menos 86
      // reais", "em conta 350 reais" como três coisas sem relação
      accessible
      accessibilityRole="header"
      accessibilityLabel={
        `${rotulo}. ${total >= 0 ? "Entrou" : "Saiu"} ` +
        `${formatBRL(Math.abs(total))} no dia` +
        (saldoNoFim === null
          ? ""
          : `. Em conta ao fim do dia, ${formatBRL(saldoNoFim)}`)
      }
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: STATEMENT_DAY_HEADER_HEIGHT,
        paddingTop: spacing[4],
        paddingBottom: spacing[2],
        // Opaco: cabeçalho fixo passa POR CIMA das linhas ao rolar
        backgroundColor: t.background.base,
      }}
    >
      <Text
        style={{
          color: t.text.secondary,
          fontSize: 13,
          lineHeight: 18,
          fontWeight: "700",
        }}
      >
        {rotulo}
      </Text>

      <View style={{ alignItems: "flex-end" }}>
        <Text
          style={{
            color: tomDoTotal,
            fontSize: 13,
            lineHeight: 18,
            fontWeight: "700",
            fontVariant: ["tabular-nums"],
          }}
        >
          {`${sinal}${formatBRL(Math.abs(total))}`}
        </Text>
        {saldoNoFim !== null && (
          <Text
            style={{
              color: t.text.tertiary,
              fontSize: 11,
              lineHeight: 14,
              fontVariant: ["tabular-nums"],
            }}
          >
            {`em conta ${formatBRL(saldoNoFim)}`}
          </Text>
        )}
      </View>
    </View>
  );
}
