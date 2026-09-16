import React, { useContext } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Sparkles from "lucide-react-native/dist/esm/icons/sparkles";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TabBarHeightContext } from "../routes/tabBarHeight";
import * as Haptics from "../utils/haptics";
import Animated from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";
import { radius, shadow, spacing } from "../theme/ds";
import { useMotionPresets } from "../theme/motionPresets";
import BrandGradient from "./BrandGradient";
import { boxNone } from "../utils/pointerEvents";
import { assistantLabel, type AssistantOrigin } from "../utils/assistantEntry";

interface AssistantFABProps {
  label?: string;
  /**
   * Distância explícita do rodapé. Sem ela o botão decide sozinho — ver
   * `useAssistantFabOffset`. Só passe quando a tela tem um rodapé próprio
   * (barra de ações fixa) que o botão precisa respeitar.
   */
  bottomOffset?: number;
  /**
   * De qual tela a porta está sendo aberta (EC-201).
   *
   * Muda o RÓTULO do botão e as perguntas sugeridas do outro lado. NÃO muda
   * o que o servidor lê: os números continuam saindo do banco, sempre.
   * Omitir é legítimo e cai no genérico.
   */
  origin?: AssistantOrigin;
}

/**
 * Altura do botão (ícone 18 + 12 de padding em cima e embaixo + as duas
 * bordas de 2 do halo). Exportada para as listas reservarem rodapé pelo
 * tamanho real do que flutua sobre elas, em vez de chutar um `pb-32`.
 */
export const ASSISTANT_FAB_HEIGHT = 52;

/** Respiro entre o botão e o que está abaixo dele (barra de abas ou borda). */
export const ASSISTANT_FAB_GAP = spacing[5];

/**
 * Onde o botão assenta — e a folga dupla que isto corrige.
 *
 * <p>O botão sempre somou `insets.bottom` ao respiro. Numa tela de pilha isso
 * é certo: o rodapé é a borda do aparelho e a barra de gestos do iPhone come
 * 34 px dali. Numa ABA, porém, a barra inferior já paga esse inset (é ela que
 * encosta na borda — `routes/index.tsx`, `tabBarStyle.height`), e o React
 * Navigation NÃO desconta isso do contexto de insets da cena: dentro da aba
 * `useSafeAreaInsets().bottom` continua devolvendo os 34. Resultado, medido
 * em 16/09/2026 na web a 390 px com o inset de 34 emulado: na Home o botão
 * flutuava 54 px acima da barra de abas, contra os 20 de uma tela de pilha —
 * o dobro do respiro, e visivelmente "solto" sobre o calendário.
 *
 * <p>A pista de "estou numa aba" é o `TabBarHeightContext`, que o navegador
 * de abas fornece a toda cena sob a barra (inclusive às abas superiores de
 * Finanças, que vivem dentro dele) e que é `undefined` no resto do app. Assim
 * as telas não precisam saber em que navegador estão. O contexto é NOSSO e
 * não o do React Navigation — o motivo está em `routes/tabBarHeight.ts`, e
 * envolvia dez suítes de teste que paravam de rodar.
 *
 * <p>Exportado para as listas reservarem o rodapé com a MESMA conta que o
 * botão usa: `useAssistantFabOffset() + ASSISTANT_FAB_HEIGHT + spacing[4]`.
 */
export function useAssistantFabOffset(bottomOffset?: number): number {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(TabBarHeightContext);
  if (bottomOffset !== undefined) return bottomOffset;
  return tabBarHeight === undefined
    ? insets.bottom + ASSISTANT_FAB_GAP
    : ASSISTANT_FAB_GAP;
}

export default function AssistantFAB({
  label,
  bottomOffset,
  origin,
}: AssistantFABProps) {
  const t = useTheme();
  const navigation = useNavigation();
  const { fabEntering } = useMotionPresets();
  const bottom = useAssistantFabOffset(bottomOffset);

  // Rótulo explícito vence a origem; sem os dois, o genérico. "Fale com o
  // Nino" em toda parte é o mesmo botão de sempre — dizer sobre O QUÊ se vai
  // falar é o que transforma um botão numa porta
  const rotulo = label ?? assistantLabel(origin);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    (navigation as any).navigate("IA Assist", origin ? { origin } : undefined);
  };

  return (
    <Animated.View
      testID="assistant-fab"
      entering={fabEntering}
      // O halo e a sombra passam da área do botão: sem o `box-none` a moldura
      // invisível deles rouba o clique de quem está por baixo
      style={[
        boxNone,
        {
          position: "absolute",
          right: spacing[5],
          bottom,
        },
      ]}
    >
      <TouchableOpacity
        accessibilityLabel={rotulo}
        activeOpacity={0.85}
        onPress={handlePress}
        style={[
          {
            borderRadius: radius.full,
            overflow: "hidden",
            padding: 2,
          },
          shadow.glow,
        ]}
      >
        {/* O halo era um gradiente girando em laço infinito. Movimento sem fim
            na borda da tela puxa o olho a cada relance e não informa nada — o
            botão não está carregando coisa alguma. Ficou o mesmo halo, parado:
            a marca continua ali, a atenção volta para o conteúdo */}
        <BrandGradient
          colors={[
            t.accent.neon,
            t.semantic.info,
            t.accent.neon,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: radius.full,
            padding: 2,
          }}
        >
          <View
            style={{
              backgroundColor: t.background.elevated,
              borderRadius: radius.full,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[3],
              gap: spacing[2],
            }}
          >
            <Sparkles size={18} color={t.accent.neon} />
            <Text
              style={{
                color: t.text.primary,
                fontWeight: "700",
                fontSize: 14,
              }}
            >
              {rotulo}
            </Text>
          </View>
        </BrandGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}
