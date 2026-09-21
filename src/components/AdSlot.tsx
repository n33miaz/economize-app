import React, { useState } from "react";
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import ChevronRight from "lucide-react-native/dist/esm/icons/chevron-right";
import Clock from "lucide-react-native/dist/esm/icons/clock";
import Landmark from "lucide-react-native/dist/esm/icons/landmark";
import Sparkles from "lucide-react-native/dist/esm/icons/sparkles";
import Upload from "lucide-react-native/dist/esm/icons/upload";
import type { LucideIcon } from "lucide-react-native";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { usePlanStore } from "../store/planStore";
import { getAdProvider, nextHouseAd } from "../utils/ads";

/**
 * Alturas FIXAS por variante. Anúncio que muda de tamanho depois de carregar
 * empurra o conteúdo debaixo do dedo — o "pulo de layout" que faz o usuário
 * clicar no que não queria. O slot reserva o espaço antes e o mantém.
 *
 * <p>Os números subiram em 15/09/2026. A legenda "Publicidade" era desenhada
 * em `position: absolute` por cima da linha de conteúdo, e nos 64 px do
 * telefone ela caía em cima do título e do ícone — o dono apontou o resultado
 * como "muito mal espaçado", e estava certo: não era espaçamento apertado,
 * era sobreposição. Agora a legenda tem linha própria, e a altura paga por
 * ela.
 *
 * <p>A conta dos 88 do telefone, para ninguém precisar refazê-la: 8 de topo +
 * 52 da linha de conteúdo (título 16 + 2 + duas linhas de corpo a 15) + 12 de
 * base, e os 16 que sobram são o respiro interno. As alturas de linha abaixo
 * são explícitas por isso — sem elas cada plataforma arredonda a fonte do seu
 * jeito e a soma deixa de fechar.
 *
 * <p>Estas alturas são da CAIXA, não do espaço que o slot ocupa. A legenda
 * passou a viver ACIMA dela (escolha 11 do comparador de 16/09), e por isso o
 * bloco inteiro pede 18 px a mais que a caixa. O dono viu essa contrapartida
 * escrita — *"ocupa um pouco mais de altura"* — e escolheu assim mesmo: o que
 * está em jogo é ninguém confundir anúncio com conteúdo nosso.
 */
// Respiro entre a legenda e a moldura. 6 e não 8: a legenda precisa ler como
// etiqueta DA caixa logo abaixo, não como uma linha solta entre dois blocos
const LEGENDA_RESPIRO = 6;

const BANNER_HEIGHT_PHONE = 88;
const BANNER_HEIGHT_DESKTOP = 104;
const CARD_HEIGHT = 144;

// Respiro lateral quando o slot é filho direto de uma lista sem gutter.
// Igual ao `padding: spacing[5]` que as telas com gutter próprio já usam,
// para o anúncio alinhar com os cards vizinhos e não com a borda da tela
export const AD_SLOT_INSET = spacing[5];

const ICONS: Record<string, LucideIcon> = {
  plus: Sparkles,
  "conectar-banco": Landmark,
  "importar-extrato": Upload,
  renda: Clock,
};

interface AdSlotProps {
  /** `banner` é a faixa entre blocos; `card` é o bloco inteiro numa lista. */
  variant?: "banner" | "card";
  /**
   * Respiro lateral por conta do slot. É OPT-IN de propósito: nas telas cujo
   * contêiner já tem `padding: spacing[5]` o respiro viria em dobro e o
   * anúncio ficaria mais estreito que os cards ao lado. Liga-se onde o slot
   * é filho direto de uma lista sem gutter — o caso que deixava o banner
   * colado nas duas bordas do telefone.
   */
  inset?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * O espaço de anúncio.
 *
 * <p>Regras que o componente garante por conta própria, para nenhuma tela
 * precisar lembrar delas: some POR COMPLETO quando a conta não tem anúncios
 * (nem o espaço fica), tem altura fixa, não tem sombra (não é conteúdo, não
 * pode parecer card de dado), leva a legenda "Publicidade" e é um único
 * toque acessível. Nunca cobre nada, nunca é fixo na tela: quem o coloca,
 * coloca no fluxo da lista, como qualquer outro bloco.
 *
 * <p>O que aparece dentro vem de `utils/ads` — hoje só a casa. O ponto de
 * troca para uma rede de terceiros é lá, não aqui.
 */
export default function AdSlot({
  variant = "banner",
  inset = false,
  style,
}: AdSlotProps) {
  const t = useTheme();
  const navigation = useNavigation();
  const { isDesktop } = useBreakpoint();
  const adsEnabled = usePlanStore((s) => s.adsEnabled);
  // Sorteado UMA vez por montagem: rotação em loop dentro do slot vira
  // banner piscando, e o que já está na tela não deve mudar sob o olhar
  const [ad] = useState(() => nextHouseAd());

  if (!adsEnabled || getAdProvider() === "none") return null;

  const isCard = variant === "card";
  const height = isCard
    ? CARD_HEIGHT
    : isDesktop
      ? BANNER_HEIGHT_DESKTOP
      : BANNER_HEIGHT_PHONE;
  const Icon = ICONS[ad.id] ?? Sparkles;

  return (
    <View style={[inset ? { marginHorizontal: AD_SLOT_INSET } : null, style]}>
      {/* A legenda é obrigatória e é o que separa anúncio de conteúdo. Fica
          FORA da moldura, em linha própria: dentro da caixa ela ainda podia
          ser lida como parte do que o anúncio diz.
          
          Ela NÃO é escondida do leitor de tela. Eu a tinha marcado com
          `accessibilityElementsHidden` para evitar ouvir "publicidade" duas
          vezes, e o teste desta suíte caiu em cima — com razão: quem depende
          do leitor é justamente quem não vê a moldura tracejada. O que saiu
          foi o prefixo REDUNDANTE do rótulo do botão, logo abaixo. Agora a
          ordem de leitura é "Publicidade", e depois o que o anúncio diz. */}
      <Text
        style={{
          color: t.text.tertiary,
          fontSize: 10,
          lineHeight: 12,
          fontWeight: "700",
          letterSpacing: 1,
          textTransform: "uppercase",
          marginBottom: LEGENDA_RESPIRO,
        }}
      >
        Publicidade
      </Text>

      <Pressable
        accessibilityRole="button"
        // Sem o prefixo "Publicidade:": quem lê a tela já ouviu a legenda
        // acima, em linha própria
        accessibilityLabel={`${ad.title}. ${ad.body}`}
        accessibilityHint={ad.cta}
        // Forma de objeto porque o destino pode ser aninhado ("Main" → aba →
        // sub-aba); o `as never` é o mesmo alargamento que o resto do app usa,
        // já que não há `RootParamList` declarado
        onPress={() =>
          navigation.navigate({
            name: ad.route.name,
            params: ad.route.params,
          } as never)
        }
        style={({ pressed }) => [
          {
            height,
            borderRadius: radius.xl,
            borderWidth: 1,
            // TRACEJADA, e num cinza mais presente que o `subtle` de antes.
            // É o que a escolha 11 pede e o que faz o trabalho: contorno
            // contínuo é a linguagem dos nossos cards, e o anúncio não pode
            // falar a mesma língua do dado que a pessoa veio ver
            borderStyle: "dashed",
            borderColor: t.border.default,
            // `elevated` e não `surface`: o slot precisa se destacar do fundo
            // da página o suficiente para ler como um bloco, senão o ícone e
            // o texto parecem soltos no vazio
            backgroundColor: t.background.elevated,
            overflow: "hidden",
            paddingHorizontal: spacing[4],
            paddingTop: spacing[2],
            paddingBottom: isCard ? spacing[4] : spacing[3],
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: isCard ? 44 : 36,
              height: isCard ? 44 : 36,
              borderRadius: radius.full,
              backgroundColor: t.accent.neonMuted,
              alignItems: "center",
              justifyContent: "center",
              marginRight: spacing[3],
            }}
          >
            <Icon size={isCard ? 22 : 18} color={t.accent.neon} />
          </View>

          {/* `minWidth: 0` é o que permite à coluna ENCOLHER na web: sem ele o
              flex mantém a largura do texto mais longo, o `numberOfLines` nunca
              corta e o CTA é empurrado para fora dos 390 px */}
          <View style={{ flex: 1, minWidth: 0, marginRight: spacing[3] }}>
            <Text
              numberOfLines={1}
              style={{
                color: t.text.primary,
                fontSize: isCard ? 15 : 13,
                lineHeight: isCard ? 20 : 16,
                fontWeight: "700",
              }}
            >
              {ad.title}
            </Text>
            <Text
              numberOfLines={isCard ? 3 : 2}
              style={{
                color: t.text.secondary,
                fontSize: isCard ? 13 : 11,
                lineHeight: isCard ? 18 : 15,
                marginTop: 2,
              }}
            >
              {ad.body}
            </Text>
          </View>

          {/* O CTA não encolhe: o que cede espaço é o corpo, que já tem corte */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <Text
              style={{
                color: t.accent.neon,
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              {ad.cta}
            </Text>
            <ChevronRight size={14} color={t.accent.neon} />
          </View>
        </View>
      </Pressable>
    </View>
  );
}
