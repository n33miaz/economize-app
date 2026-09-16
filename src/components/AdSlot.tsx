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
 */
const BANNER_HEIGHT_PHONE = 88;
const BANNER_HEIGHT_DESKTOP = 104;
const CARD_HEIGHT = 144;

const ICONS: Record<string, LucideIcon> = {
  plus: Sparkles,
  "conectar-banco": Landmark,
  "importar-extrato": Upload,
  renda: Clock,
};

interface AdSlotProps {
  /** `banner` é a faixa entre blocos; `card` é o bloco inteiro numa lista. */
  variant?: "banner" | "card";
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
export default function AdSlot({ variant = "banner", style }: AdSlotProps) {
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Publicidade: ${ad.title}. ${ad.body}`}
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
          borderColor: t.border.subtle,
          // `elevated` e não `surface`: o slot precisa se destacar do fundo da
          // página o suficiente para ler como um bloco, senão o ícone e o
          // texto parecem soltos no vazio
          backgroundColor: t.background.elevated,
          overflow: "hidden",
          paddingHorizontal: spacing[4],
          paddingTop: spacing[2],
          paddingBottom: isCard ? spacing[4] : spacing[3],
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {/* A legenda é obrigatória e é o que separa anúncio de conteúdo.
          Minúscula e terciária porque precisa ser lida, não gritada — e em
          LINHA PRÓPRIA, porque em `absolute` ela caía por cima do título */}
      <Text
        style={{
          color: t.text.tertiary,
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.8,
          textTransform: "uppercase",
          textAlign: "right",
          marginBottom: spacing[1],
        }}
      >
        Publicidade
      </Text>

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

        <View style={{ flex: 1, marginRight: spacing[3] }}>
          <Text
            numberOfLines={1}
            style={{
              color: t.text.primary,
              fontSize: isCard ? 15 : 13,
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

        <View style={{ flexDirection: "row", alignItems: "center" }}>
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
  );
}
