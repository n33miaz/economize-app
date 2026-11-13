import React, { useCallback, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Plus from "lucide-react-native/dist/esm/icons/plus";
import Target from "lucide-react-native/dist/esm/icons/target";

import BudgetBar from "./BudgetBar";
import BudgetSheet, { type BudgetTarget } from "./BudgetSheet";
import Card from "./Card";
import CategoryPickerSheet from "./CategoryPickerSheet";
import ErrorState from "./ErrorState";
import { type BudgetStatus, getBudgetStatus } from "../services/api";
import { describeLoadFailure } from "../services/requestFailure";
import { useTheme } from "../theme/ThemeProvider";
import { spacing, touchArea } from "../theme/ds";
import type { AnalysisRange } from "../utils/cycleWindow";

interface Props {
  /** O MESMO recorte que a tela está lendo — o teto acompanha o ciclo. */
  range: AnalysisRange | null;
}

/**
 * Os tetos de categoria, e como cada um está indo — EC-204.
 *
 * <p><b>Por que ele mora na Análise.</b> Aqui é onde o número "Mercado:
 * R$ 900" aparece, e é olhando para ele que alguém decide pôr um limite.
 * Obrigar a pessoa a sair, procurar uma tela de configuração e voltar é como
 * se perde a intenção no caminho — a mesma razão do EC-198, que trouxe a
 * troca de categoria para onde o número está.
 *
 * <p><b>Ele responde DUAS perguntas, porque são diferentes.</b> "Estourou" e
 * "o ritmo leva a estourar" não são a mesma notícia: 20% do teto no terceiro
 * dia é ruim e no vigésimo oitavo é ótimo. Quem faz essa conta é o servidor,
 * que conhece o tamanho da janela; aqui só se desenha.
 *
 * <p><b>O painel some quando não há teto nenhum?</b> Não: fica o convite. Um
 * recurso que só aparece depois de configurado nunca é configurado.
 */
export default function BudgetPanel({ range }: Props) {
  const t = useTheme();

  const [status, setStatus] = useState<BudgetStatus | null>(null);
  const [picking, setPicking] = useState(false);
  const [target, setTarget] = useState<BudgetTarget | null>(null);
  // Falha própria do painel. Antes a falha virava `status = null`, e o painel
  // sem dado se confundia com o painel sem teto: a tela convidava a "pôr um
  // teto" quem já tinha vários, só porque a rede caiu
  const [error, setError] = useState<string | null>(null);
  // Sequência das leituras: na troca rápida de mês, a resposta atrasada do
  // mês anterior chegava depois e desenhava as barras erradas
  const ultimaLeitura = useRef(0);

  const load = useCallback(() => {
    if (!range) return;
    const minhaVez = ++ultimaLeitura.current;
    // Continua sendo leitura de apoio: a falha fica DENTRO do painel e a
    // Análise, que é a resposta principal, segue de pé
    getBudgetStatus(range)
      .then((next) => {
        if (minhaVez !== ultimaLeitura.current) return;
        setStatus(next);
        setError(null);
      })
      .catch((e) => {
        if (minhaVez !== ultimaLeitura.current) return;
        const message = describeLoadFailure(e, "Não foi possível carregar os tetos.");
        // Sessão encerrada devolve frase vazia: não há o que mostrar a quem saiu
        if (!message) return;
        setError(message);
      });
  }, [range]);

  // No foco, e não só na montagem: depois de categorizar na Revisão e
  // voltar, o gasto por categoria mudou e as barras ficavam velhas. O
  // useFocusEffect também roda de novo quando `load` muda (recorte novo)
  useFocusEffect(load);

  const linhas = status?.lines ?? [];

  return (
    <>
      <Card style={{ marginTop: spacing[4] }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Target size={14} color={t.text.tertiary} />
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
            Tetos por categoria
          </Text>
          <TouchableOpacity
            onPress={() => setPicking(true)}
            accessibilityRole="button"
            accessibilityLabel="Pôr um teto numa categoria"
            style={touchArea(18)}
          >
            <Plus size={18} color={t.accent.neon} />
          </TouchableOpacity>
        </View>

        {error ? (
          // Com barras antigas na tela, elas ficam e a faixa avisa por cima;
          // sem nenhuma, a faixa ocupa o lugar do convite
          <View style={{ marginTop: spacing[3] }}>
            <ErrorState compact message={error} onRetry={load} />
          </View>
        ) : null}

        {linhas.length === 0 ? (
          error ? null : (
          <Text
            style={{
              color: t.text.secondary,
              fontSize: 13,
              marginTop: spacing[3],
            }}
          >
            Ponha um teto numa categoria e o app avisa quando você estourar — e
            antes disso, quando o ritmo estiver levando lá.
          </Text>
          )
        ) : (
          <>
            <Text
              style={{
                color: t.text.secondary,
                fontSize: 13,
                marginTop: spacing[1],
                marginBottom: spacing[4],
              }}
            >
              {resumo(status)}
            </Text>
            {linhas.map((linha) => (
              <TouchableOpacity
                key={linha.categoryId}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Ajustar o teto de ${
                  linha.categoryName ?? "Sem categoria"
                }`}
                onPress={() =>
                  setTarget({
                    categoryId: linha.categoryId,
                    categoryName: linha.categoryName,
                    monthlyLimit: linha.monthlyLimit,
                  })
                }
              >
                <BudgetBar line={linha} />
              </TouchableOpacity>
            ))}
          </>
        )}
      </Card>

      <CategoryPickerSheet
        visible={picking}
        onClose={() => setPicking(false)}
        onSelect={(categoria) => {
          setPicking(false);
          // O teto que já existe vem do próprio status: reabrir a folha sobre
          // uma categoria limitada tem de mostrar o valor atual, não um campo
          // em branco que pareceria "ainda não tem"
          const atual = linhas.find((l) => l.categoryId === categoria.id);
          setTarget({
            categoryId: categoria.id,
            categoryName: categoria.name,
            monthlyLimit: atual?.monthlyLimit ?? null,
          });
        }}
      />

      <BudgetSheet
        visible={target !== null}
        target={target}
        onClose={() => setTarget(null)}
        onSaved={load}
      />
    </>
  );
}

/**
 * A frase de cima, e ela nomeia as duas perguntas separadas.
 *
 * "1 estourado e 2 no ritmo de estourar" diz mais que "3 avisos": o primeiro
 * já aconteceu, os outros ainda dá para evitar.
 */
function resumo(status: BudgetStatus | null): string {
  if (!status) return "";
  const total = status.lines.length;
  const partes: string[] = [];
  if (status.exceededCount > 0) {
    partes.push(
      status.exceededCount === 1 ? "1 estourado" : `${status.exceededCount} estourados`,
    );
  }
  if (status.abovePaceCount > 0) {
    partes.push(
      status.abovePaceCount === 1
        ? "1 no ritmo de estourar"
        : `${status.abovePaceCount} no ritmo de estourar`,
    );
  }
  const acompanhando = `${total} ${total === 1 ? "teto" : "tetos"} neste período`;
  return partes.length === 0
    ? `${acompanhando} · tudo dentro`
    : `${acompanhando} · ${partes.join(" e ")}`;
}
