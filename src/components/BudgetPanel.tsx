import React, { useCallback, useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Plus from "lucide-react-native/dist/esm/icons/plus";
import Target from "lucide-react-native/dist/esm/icons/target";

import BudgetBar from "./BudgetBar";
import BudgetSheet, { type BudgetTarget } from "./BudgetSheet";
import Card from "./Card";
import CategoryPickerSheet from "./CategoryPickerSheet";
import { type BudgetStatus, getBudgetStatus } from "../services/api";
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

  const load = useCallback(() => {
    if (!range) return;
    // Best-effort, como as demais leituras de apoio da tela: uma falha aqui
    // apaga o painel e mantém a Análise, que é a resposta principal
    getBudgetStatus(range)
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [range]);

  useEffect(load, [load]);

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

        {linhas.length === 0 ? (
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
