import React, { useEffect } from "react";
import { View, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import CircleAlert from "lucide-react-native/dist/esm/icons/circle-alert";
import CircleCheck from "lucide-react-native/dist/esm/icons/circle-check";
import Info from "lucide-react-native/dist/esm/icons/info";
import TriangleAlert from "lucide-react-native/dist/esm/icons/triangle-alert";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToastStore } from "../store/toastStore";
import { boxNone } from "../utils/pointerEvents";
import { useTheme } from "../theme/ThemeProvider";
import { motion, spacing } from "../theme/ds";

// Distância do cartão à borda segura do topo. Fora da tela ele espera em
// -150, que é mais que a altura do cartão em qualquer largura
const TOAST_TOP_GAP = spacing[3];
const TOAST_HIDDEN_Y = -150;

export default function Toast() {
  const t = useTheme();
  const { visible, message, type } = useToastStore();
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(TOAST_HIDDEN_Y);
  // EC-054: com "reduzir movimento" ligado, o toast APARECE e SOME, sem
  // deslizar. A mensagem continua sendo entregue — o que sai é o percurso,
  // que é justamente o que incomoda quem pediu menos movimento
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // O inset é o relógio/notch do aparelho; o respiro vem da escala de
    // espaçamento, como o resto da tela — não de um literal
    const destino = visible ? insets.top + TOAST_TOP_GAP : TOAST_HIDDEN_Y;
    if (reducedMotion) {
      translateY.value = destino;
      return;
    }
    if (visible) {
      // Damping mais alto: o toast assenta sem quicar (motion intencional)
      translateY.value = withSpring(destino, { damping: 20, stiffness: 160 });
    } else {
      translateY.value = withTiming(destino, { duration: motion.duration.base });
    }
  }, [visible, insets.top, reducedMotion, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Fundo elevated único; o tipo colore apenas o ícone — no dark os tons
  // semânticos puros como fundo estouram e quebram o contraste do texto
  const getToastConfig = () => {
    switch (type) {
      case "error":
        return { color: t.semantic.danger, Icon: CircleAlert };
      case "success":
        return { color: t.semantic.success, Icon: CircleCheck };
      case "warning":
        return { color: t.semantic.warning, Icon: TriangleAlert };
      default:
        return { color: t.semantic.info, Icon: Info };
    }
  };

  const config = getToastConfig();
  const ToastIcon = config.Icon;

  return (
    <View
      testID="toast-layer"
      className="absolute inset-0 items-center justify-start"
      // A camada cobre a tela inteira só para posicionar o toast, e ela fica
      // montada SEMPRE — o cartão apenas desliza para fora quando não há
      // mensagem. Por isso o `elevation` NÃO pode morar aqui: no Android a
      // elevação entra no teste de toque, e uma camada de tela inteira
      // elevada intercepta o toque mesmo com `box-none`. Era isso que fazia o
      // pote da Home não abrir a folha de estados e o "Entendi" dela não
      // fechar — a web não denuncia, porque lá quem ordena é só o `zIndex`.
      // A elevação foi para o cartão: ele é pequeno e, escondido, está fora
      // da tela. Reproduzido e corrigido no emulador em 15/09/2026.
      style={[boxNone, { zIndex: 9999 }]}
    >
      <Animated.View
        className="absolute top-0 self-center max-w-[90%]"
        style={[animatedStyle, { elevation: 99 }]}
      >
        <View className="bg-elevated border border-border flex-row items-center px-4 py-3 rounded-full">
          <ToastIcon size={20} color={config.color} />
          <Text className="text-textPrimary font-bold text-sm ml-2 shrink">
            {message}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
