import React from "react";
import {
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from "react-native";
import ArrowDownRight from "lucide-react-native/dist/esm/icons/arrow-down-right";
import ArrowUpRight from "lucide-react-native/dist/esm/icons/arrow-up-right";
import Star from "lucide-react-native/dist/esm/icons/star";

import type { Indicator } from "../services/api";
import { radius, spacing } from "../theme/ds";
import { typography } from "../theme/typography";
import { useTheme } from "../theme/ThemeProvider";
import {
  dayRange,
  formatIndicatorValue,
  positionInDayRange,
} from "../utils/indicatorFormat";
import { fraseDoDia } from "../utils/marketHeadline";
import { formatDecimal, formatPercent } from "../utils/money";
import Sparkline from "./Sparkline";

/**
 * Altura da linha de tendência. A LARGURA é medida, não fixa: a linha ocupa a
 * fileira inteira abaixo do valor.
 *
 * <p>Ela começou ao LADO do valor, com 132 px. O que matou esse arranjo foi a
 * conta do pior caso no alvo declarado (Safari de iPhone 12, 390 px): sobravam
 * 166 px para o valor, e "179.722 pts" no corpo 36 mede ~238. Encolher o corpo
 * resolvia no aparelho e não na web, onde o `adjustsFontSizeToFit` é ignorado
 * — o `typography.ts` já documenta essa armadilha. Com a linha embaixo, o
 * valor ganha os 310 px inteiros e a linha ganha forma de verdade.
 */
const LINHA_ALTURA = 44;

/** Altura da barra da faixa do dia, e o diâmetro da marca sobre ela. */
const BARRA_ALTURA = 4;
const MARCA = 10;

interface Props {
  indicador: Indicator;
  /** "favorito" quando a pessoa escolheu; "destaque" quando é curadoria. */
  origem: "favorito" | "destaque";
  onPress: () => void;
}

/**
 * A MANCHETE do Mercado.
 *
 * <p>Escolha 10 do dono em 16/09/2026: <i>"o topo vira uma manchete: o ativo
 * que você mais olha, grande, com linha de tendência, faixa do dia e a frase
 * do que aconteceu"</i>.
 *
 * <p><b>O que havia antes.</b> Uma fita horizontal de cards pequenos e iguais,
 * cada um com preço e porcentagem. O dono tinha olhado essa tela e dito que
 * estava <i>"muito pobre — nenhum usuário vai usar"</i>, e o diagnóstico
 * estava certo: seis cards do mesmo tamanho não têm manchete, e porcentagem do
 * dia não conta história. A fita continua existindo abaixo; o que ela deixou
 * de ser é a primeira coisa da tela.
 *
 * <p><b>A barra da faixa do dia</b> é a única informação genuinamente nova
 * aqui, e é a que a porcentagem não dá: "subiu 1,2%" e "está a um centavo da
 * máxima do dia" são fatos diferentes. Sem mínima e máxima da fonte, a barra
 * não é desenhada — barra sem faixa seria uma régua sem escala.
 *
 * <p>O valor sai de `formatIndicatorValue`, a MESMA função dos cards da grade
 * logo abaixo. Duas cópias da regra fariam o IBOVESPA aparecer como
 * "179.722 pts" aqui e "R$ 179.722,48" ali — que foi um defeito real desta
 * tela.
 */
export default function MarketHeadline({ indicador, origem, onPress }: Props) {
  const t = useTheme();

  const valor = indicador.points ?? indicador.buy;
  const variacao = Number(indicador.variation) || 0;
  const subiu = variacao >= 0;
  const tom = variacao > 0 ? "up" : variacao < 0 ? "down" : "neutral";
  const corDaVariacao =
    variacao > 0
      ? t.semantic.success
      : variacao < 0
        ? t.semantic.danger
        : t.text.tertiary;
  const Seta = subiu ? ArrowUpRight : ArrowDownRight;

  const faixa = dayRange(indicador.dayLow, indicador.dayHigh);
  const posicao = positionInDayRange(
    valor,
    indicador.dayLow,
    indicador.dayHigh,
  );
  const frase = fraseDoDia(indicador);

  // A linha de tendência ocupa a fileira inteira: sem medir, o SVG precisaria
  // de uma largura fixa e sobraria (ou faltaria) espaço em cada aparelho
  const [larguraDaLinha, setLarguraDaLinha] = React.useState(0);
  const medirLinha = React.useCallback((e: LayoutChangeEvent) => {
    setLarguraDaLinha(e.nativeEvent.layout.width);
  }, []);
  const nome = indicador.name?.split("/")[0].trim() || indicador.code;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      // Uma frase só: sem isto o leitor de tela leria código, valor, variação,
      // os dois extremos e a frase como seis coisas sem relação
      accessibilityLabel={
        `${origem === "favorito" ? "Seu favorito" : "Destaque"}: ` +
        `${nome}. ${formatIndicatorValue({
          value: valor,
          type: indicador.type,
        })}. ${frase} Abrir detalhes`
      }
      style={{
        padding: spacing[5],
        borderRadius: radius["3xl"],
        borderWidth: 1,
        borderColor: t.border.default,
        backgroundColor: t.background.surface,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {origem === "favorito" && (
          <Star
            size={12}
            color={t.accent.neon}
            fill={t.accent.neon}
            style={{ marginRight: spacing[1] }}
          />
        )}
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            color: t.text.tertiary,
            fontSize: 12,
            fontWeight: "700",
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          {indicador.code || nome}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          marginTop: spacing[2],
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            // O maior número da tela: é isto que faz dela uma manchete em vez
            // de mais um card. `numericDisplay` é o degrau de cima da escala
            ...typography.numericDisplay,
            color: t.text.primary,
            flexShrink: 1,
          }}
        >
          {formatIndicatorValue({ value: valor, type: indicador.type })}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginLeft: spacing[2],
            flexShrink: 0,
          }}
        >
          <Seta size={14} color={corDaVariacao} />
          <Text
            style={{
              color: corDaVariacao,
              fontSize: 14,
              fontWeight: "700",
              fontVariant: ["tabular-nums"],
              marginLeft: 2,
            }}
          >
            {formatPercent(variacao, { signed: true })}
          </Text>
        </View>
      </View>

      {/* A cor da linha vem da VARIAÇÃO, não do último ponto: uma linha que
          discordasse do número acima dela seria pior que linha nenhuma.
          A largura é medida — a altura fica reservada desde o primeiro quadro
          para o card não mudar de tamanho quando a medida chega */}
      <View
        onLayout={medirLinha}
        style={{ height: LINHA_ALTURA, marginTop: spacing[3] }}
      >
        {larguraDaLinha > 0 && (
          <Sparkline
            values={indicador.sparkline}
            tone={tom}
            width={larguraDaLinha}
            height={LINHA_ALTURA}
          />
        )}
      </View>

      {faixa && posicao !== null && (
        <View style={{ marginTop: spacing[4] }}>
          <View
            style={{
              height: BARRA_ALTURA,
              borderRadius: radius.full,
              backgroundColor: t.border.default,
              justifyContent: "center",
            }}
          >
            {/* A marca do preço de agora dentro da faixa. `positionInDayRange`
                já prende o valor ao intervalo: cotação e extremos chegam da
                fonte em momentos diferentes, e um centavo fora punha a marca
                do lado de fora da barra */}
            <View
              style={{
                position: "absolute",
                left: `${posicao * 100}%`,
                width: MARCA,
                height: MARCA,
                borderRadius: radius.full,
                backgroundColor: corDaVariacao,
                marginLeft: -MARCA / 2,
              }}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: spacing[1],
            }}
          >
            <Text style={{ color: t.text.tertiary, fontSize: 11 }}>
              {formatDecimal(faixa.baixa)}
            </Text>
            <Text style={{ color: t.text.tertiary, fontSize: 11 }}>
              {formatDecimal(faixa.alta)}
            </Text>
          </View>
        </View>
      )}

      <Text
        style={{
          color: t.text.secondary,
          fontSize: 13,
          lineHeight: 18,
          marginTop: spacing[3],
        }}
      >
        {frase}
      </Text>
    </TouchableOpacity>
  );
}
