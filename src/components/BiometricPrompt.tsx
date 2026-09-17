import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Check from "lucide-react-native/dist/esm/icons/check";
import FingerprintPattern from "lucide-react-native/dist/esm/icons/fingerprint-pattern";

import CustomModal from "./CustomModal";
import { useTheme } from "../theme/ThemeProvider";
import { radius, SHEET_PADDING, spacing } from "../theme/ds";

/**
 * Quanto dura o selo de sucesso antes de a folha descer.
 *
 * Exportado de proposito: quem chama precisa esperar ESTE tempo antes de sair
 * da tela, senao a animacao e cortada no primeiro quadro. Numero unico, nos
 * dois lados — duplicar 550 aqui e la e a forma classica de eles divergirem.
 */
export const DURACAO_SELO_MS = 620;

interface Props {
  visible: boolean;
  /**
   * Ligar a biometria. Resolve `false` quando o usuário não confirma no
   * prompt do sistema — o modal continua aberto para ele decidir de novo.
   */
  onEnable: () => Promise<boolean>;
  /** Recusar. `dontAskAgain` é o estado do check no momento do toque. */
  onDecline: (dontAskAgain: boolean) => void;
}

/**
 * A oferta de desbloqueio por biometria, logo depois do login.
 *
 * <p>O check "não perguntar novamente" é a diferença que dá sentido ao modal:
 * sem ele, dizer "agora não" uma vez calava a oferta para sempre (era o que a
 * versão anterior fazia, silenciosamente) — e quem quisesse ligar depois tinha
 * de descobrir sozinho o caminho no Perfil. Com ele, recusar é recusar HOJE; a
 * decisão definitiva é um gesto explícito, marcado pelo próprio usuário.
 */
export default function BiometricPrompt({
  visible,
  onEnable,
  onDecline,
}: Props) {
  const t = useTheme();
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [working, setWorking] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  /**
   * A "animacaozinha ao liberar o acesso", pedida pelo dono em 16/09/2026.
   *
   * O que ela resolve: hoje a digital e aceita e a tela simplesmente troca. Nao
   * ha instante nenhum que diga "deu certo" — e desbloqueio e exatamente o
   * momento em que a pessoa quer confirmacao. O anel muda para verde, o icone
   * vira um visto e o circulo da um pulo curto; so depois a folha desce.
   *
   * Escala e cor apenas: nada de deslocamento em animacao de entrada, pela
   * mesma razao do resto do app na web.
   */
  // Dois valores, cada um com um trabalho: `escala` da o pulo, `verde` faz a
  // travessia de cor. Um so exigiria remapear duas faixas diferentes a partir
  // do mesmo numero, que e a origem classica de animacao que "pisca".
  const escala = useSharedValue(1);
  const verde = useSharedValue(0);
  useEffect(() => {
    if (!sucesso) {
      escala.value = 1;
      verde.value = 0;
      return;
    }
    escala.value = withSequence(
      withTiming(1.12, { duration: 220, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }),
    );
    verde.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) });
  }, [sucesso, escala, verde]);

  const estiloAnel = useAnimatedStyle(() => ({
    transform: [{ scale: escala.value }],
    borderColor: interpolateColor(
      verde.value,
      [0, 1],
      [t.accent.neon, t.semantic.success],
    ),
    backgroundColor: interpolateColor(
      verde.value,
      [0, 1],
      [t.accent.neonMuted, t.semantic.successMuted],
    ),
  }));

  // Reabrir é uma pergunta nova: o check marcado e abandonado numa sessão
  // anterior não pode voltar já respondido
  useEffect(() => {
    if (visible) {
      setDontAskAgain(false);
      setWorking(false);
      setSucesso(false);
    }
  }, [visible]);

  const handleEnable = async () => {
    if (working) return;
    setWorking(true);
    const ok = await onEnable();
    // Só solta o botão se a folha continuar aberta — quando dá certo ela
    // fecha, e mexer no estado depois disso é atualizar componente desmontado
    if (!ok) {
      setWorking(false);
      return;
    }
    // Deu certo: o selo aparece AQUI, e quem chama segura a saída da tela por
    // DURACAO_SELO_MS para ele caber na tela antes de a folha descer
    setSucesso(true);
  };

  return (
    <CustomModal visible={visible} onClose={() => onDecline(dontAskAgain)}>
      {/* O respiro padrão das folhas, com o topo um degrau maior: aqui o
          primeiro elemento é o círculo do ícone, e 12px o deixavam encostado
          no grabber. Antes desta linha não havia afastamento lateral nenhum,
          e o texto e os botões nasciam colados nas duas bordas. */}
      <View
        style={[
          SHEET_PADDING,
          { alignItems: "center", paddingTop: spacing[5] },
        ]}
      >
        <Animated.View
          style={[
            {
              width: 72,
              height: 72,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              marginBottom: spacing[5],
            },
            estiloAnel,
          ]}
        >
          {sucesso ? (
            <Check size={38} color={t.semantic.success} strokeWidth={3} />
          ) : (
            <FingerprintPattern size={34} color={t.accent.neon} />
          )}
        </Animated.View>

        <Text
          style={{
            color: t.text.primary,
            fontSize: 18,
            fontWeight: "700",
            textAlign: "center",
            marginBottom: spacing[3],
          }}
        >
          Entrar mais rápido da próxima vez?
        </Text>
        <Text
          style={{
            color: t.text.secondary,
            fontSize: 14,
            lineHeight: 22,
            textAlign: "center",
            marginBottom: spacing[6],
          }}
        >
          Use a digital ou o rosto para abrir o Economize! sem digitar a senha —
          e para manter seus dados trancados se o aparelho sair da sua mão.
        </Text>

        <TouchableOpacity
          accessibilityRole="checkbox"
          accessibilityLabel="Não perguntar novamente"
          accessibilityState={{ checked: dontAskAgain }}
          onPress={() => setDontAskAgain((value) => !value)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "flex-start",
            gap: spacing[3],
            paddingVertical: spacing[1],
            marginBottom: spacing[6],
          }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: radius.sm,
              borderWidth: 2,
              borderColor: dontAskAgain ? t.accent.neon : t.border.default,
              backgroundColor: dontAskAgain ? t.accent.neon : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {dontAskAgain && <Check size={14} color={t.text.inverse} />}
          </View>
          <Text style={{ color: t.text.secondary, fontSize: 14 }}>
            Não perguntar novamente
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Usar biometria"
          accessibilityState={{ disabled: working, busy: working }}
          disabled={working}
          onPress={handleEnable}
          activeOpacity={0.85}
          style={{
            width: "100%",
            backgroundColor: t.accent.neon,
            borderRadius: radius.full,
            paddingVertical: spacing[4],
            alignItems: "center",
            opacity: working ? 0.7 : 1,
          }}
        >
          {working ? (
            <ActivityIndicator color={t.text.inverse} />
          ) : (
            <Text
              style={{ color: t.text.inverse, fontWeight: "700", fontSize: 15 }}
            >
              Usar biometria
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Agora não"
          onPress={() => onDecline(dontAskAgain)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ marginTop: spacing[5], paddingVertical: spacing[2] }}
        >
          <Text
            style={{ color: t.text.secondary, fontWeight: "600", fontSize: 14 }}
          >
            Agora não
          </Text>
        </TouchableOpacity>
      </View>
    </CustomModal>
  );
}
