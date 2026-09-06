import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import Check from "lucide-react-native/dist/esm/icons/check";
import FingerprintPattern from "lucide-react-native/dist/esm/icons/fingerprint-pattern";

import CustomModal from "./CustomModal";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";

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

  // Reabrir é uma pergunta nova: o check marcado e abandonado numa sessão
  // anterior não pode voltar já respondido
  useEffect(() => {
    if (visible) {
      setDontAskAgain(false);
      setWorking(false);
    }
  }, [visible]);

  const handleEnable = async () => {
    if (working) return;
    setWorking(true);
    const ok = await onEnable();
    // Só solta o botão se a folha continuar aberta — quando dá certo ela
    // fecha, e mexer no estado depois disso é atualizar componente desmontado
    if (!ok) setWorking(false);
  };

  return (
    <CustomModal visible={visible} onClose={() => onDecline(dontAskAgain)}>
      <View style={{ alignItems: "center", paddingBottom: spacing[2] }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: radius.full,
            backgroundColor: t.accent.neonMuted,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: t.accent.neon,
            marginBottom: spacing[4],
          }}
        >
          <FingerprintPattern size={34} color={t.accent.neon} />
        </View>

        <Text
          style={{
            color: t.text.primary,
            fontSize: 18,
            fontWeight: "700",
            textAlign: "center",
            marginBottom: spacing[2],
          }}
        >
          Entrar mais rápido da próxima vez?
        </Text>
        <Text
          style={{
            color: t.text.secondary,
            fontSize: 14,
            lineHeight: 20,
            textAlign: "center",
            marginBottom: spacing[5],
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
            marginBottom: spacing[5],
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
          style={{ marginTop: spacing[4] }}
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
