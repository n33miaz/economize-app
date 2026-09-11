import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Sparkles from "lucide-react-native/dist/esm/icons/sparkles";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

export default function AssistantFAB({
  label,
  bottomOffset,
  origin,
}: AssistantFABProps) {
  const t = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { fabEntering } = useMotionPresets();

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
      entering={fabEntering}
      // O halo e a sombra passam da área do botão: sem o `box-none` a moldura
      // invisível deles rouba o clique de quem está por baixo
      style={[
        boxNone,
        {
          position: "absolute",
          right: spacing[5],
          bottom: bottomOffset ?? insets.bottom + spacing[5],
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
