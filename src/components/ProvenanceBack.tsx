import React from "react";
import { Text, View } from "react-native";
import FileInput from "lucide-react-native/dist/esm/icons/file-input";

import Card from "./Card";
import { useTheme } from "../theme/ThemeProvider";
import { spacing } from "../theme/ds";
import {
  type ProvenanceSummary,
  describeProvenanceLine,
  describeProvenanceTotal,
} from "../utils/provenanceSummary";

interface Props {
  summary: ProvenanceSummary;
  /** Quantas fontes cabem antes de virar "e mais N". */
  limit?: number;
}

/**
 * O verso de um número: de onde ele foi somado — EC-225.
 *
 * <p>É o EC-195 ganhando forma. Lá, cada linha do extrato passou a dizer por
 * onde entrou; aqui a mesma resposta vale para o <b>total</b>, que é o número
 * de que o usuário realmente desconfia. "Saí R$ 3.421 este mês" é a frase que
 * ele lê e questiona — e até aqui nada no app sabia dizer de onde ela tinha
 * sido somada.
 *
 * <p><b>Curto de propósito.</b> Quantos lançamentos, de que fontes, e só. A
 * tentação é acrescentar o período, os filtros ativos e as exclusões — e aí o
 * verso vira relatório, ninguém lê, e o card deixa de responder a pergunta que
 * motivou o toque.
 *
 * <p><b>"origem não registrada" também entra na lista.</b> É a verdade sobre o
 * histórico importado antes de a procedência existir, e escondê-la faria as
 * contagens não fecharem com o total — que é exatamente o tipo de coisa que
 * este card existe para não fazer.
 */
export default function ProvenanceBack({ summary, limit = 4 }: Props) {
  const t = useTheme();

  const mostradas = summary.lines.slice(0, limit);
  const restantes = summary.lines.length - mostradas.length;

  return (
    <Card style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <FileInput size={13} color={t.text.tertiary} />
        <Text
          style={{
            flex: 1,
            marginLeft: spacing[2],
            color: t.text.tertiary,
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          De onde veio
        </Text>
      </View>

      <Text
        style={{
          color: t.text.primary,
          fontSize: 13,
          fontWeight: "700",
          marginTop: spacing[2],
        }}
      >
        {describeProvenanceTotal(summary)}
      </Text>

      {mostradas.map((linha) => (
        <Text
          key={linha.key}
          numberOfLines={1}
          style={{
            color: t.text.secondary,
            fontSize: 12,
            marginTop: spacing[1],
          }}
        >
          {describeProvenanceLine(linha)}
        </Text>
      ))}

      {restantes > 0 ? (
        <Text style={{ color: t.text.tertiary, fontSize: 11, marginTop: spacing[1] }}>
          e mais {restantes} {restantes === 1 ? "fonte" : "fontes"}
        </Text>
      ) : null}

      <Text
        style={{
          color: t.text.tertiary,
          fontSize: 11,
          marginTop: spacing[3],
        }}
      >
        Toque de novo para voltar.
      </Text>
    </Card>
  );
}
