import React from "react";
import { Text, View } from "react-native";

import Card from "./Card";
import ProportionBar, { type Slice } from "./ProportionBar";
import { useTheme } from "../theme/ThemeProvider";
import { spacing } from "../theme/ds";
import { formatBRL, formatBRLCompact } from "../utils/money";

/** Um mês da linha do tempo, com o que já tem dono. */
export interface CommitmentMonth {
  /** `YYYY-MM`. */
  month: string;
  label: string;
  /** Parcelas de compras já feitas. */
  installments: number;
  /** Fatura de cartão prevista. */
  invoice: number;
  /** Recorrências (assinaturas, contas, aluguel). */
  recurring: number;
}

interface Props {
  months: CommitmentMonth[];
  /** Esconde os valores quando o "olhinho" está fechado. */
  showValues?: boolean;
}

/**
 * Seis meses à frente, e o que já tem dono em cada um — EC-226.
 *
 * <p><b>É a melhor peça do Pierre, e temos mais matéria-prima.</b> A linha do
 * tempo dele mostra compromisso futuro, o que é raro e é certo — a pergunta
 * "posso gastar isto?" só tem resposta quando se sabe o que já está prometido.
 * Mas ele projeta só parcelamento, e projeta errado (dizia *"1 de 3, última em
 * Agosto/2026"* em setembro).
 *
 * <p>Nós temos <b>três</b> fontes, e as três já são medidas: parcelas
 * projetadas por mês (EC-217), fatura prevista pela mediana recente, e
 * recorrências detectadas. Somadas, elas respondem quanto de cada mês já está
 * comprometido antes de ele começar.
 *
 * <p><b>A barra é a leitura; o número é a confirmação.</b> A altura relativa
 * entre os meses diz na hora qual é o apertado — comparar seis valores em
 * reais exigiria ler seis números e lembrar dos anteriores. A proporção
 * interna (parcela × fatura × recorrência) usa a mesma barra sem legenda do
 * EC-227: quem quer o detalhe toca no mês.
 *
 * <p><b>Mês sem compromisso aparece vazio, não some.</b> Um buraco na
 * sequência faria o eixo mentir sobre a distância entre os meses restantes.
 */
export default function CommitmentTimeline({ months, showValues = true }: Props) {
  const t = useTheme();
  if (months.length === 0) return null;

  const totalDe = (mes: CommitmentMonth) =>
    mes.installments + mes.invoice + mes.recurring;
  const maior = Math.max(...months.map(totalDe), 1);

  return (
    <Card>
      <Text
        style={{
          color: t.text.primary,
          fontSize: 15,
          fontWeight: "700",
          marginBottom: spacing[1],
        }}
      >
        O que já tem dono
      </Text>
      <Text
        style={{ color: t.text.secondary, fontSize: 12, marginBottom: spacing[4] }}
      >
        Parcelas, fatura prevista e o que se repete, mês a mês.
      </Text>

      {months.map((mes) => {
        const total = totalDe(mes);
        const fatias: Slice[] = [
          {
            key: "parcelas",
            value: mes.installments,
            color: t.semantic.info,
            label: "parcelas",
          },
          {
            key: "fatura",
            value: mes.invoice,
            color: t.accent.neon,
            label: "fatura prevista",
          },
          {
            key: "recorrencias",
            value: mes.recurring,
            color: t.text.tertiary,
            label: "recorrências",
          },
        ];

        return (
          <View
            key={mes.month}
            accessible
            accessibilityLabel={
              total > 0
                ? `${mes.label}: ${formatBRL(total)} comprometidos`
                : `${mes.label}: nada comprometido`
            }
            style={{ marginBottom: spacing[3] }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                marginBottom: spacing[1],
              }}
            >
              <Text style={{ flex: 1, color: t.text.secondary, fontSize: 12 }}>
                {mes.label}
              </Text>
              <Text
                style={{
                  color: total > 0 ? t.text.primary : t.text.tertiary,
                  fontSize: 13,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {!showValues ? "•••" : total > 0 ? formatBRLCompact(total) : "—"}
              </Text>
            </View>
            {/* A largura da barra é a proporção deste mês contra o MAIOR da
                janela: é ela que faz o mês apertado saltar sem ler número */}
            <View style={{ width: `${Math.max(2, (total / maior) * 100)}%` }}>
              <ProportionBar slices={fatias} height={8} />
            </View>
          </View>
        );
      })}
    </Card>
  );
}
