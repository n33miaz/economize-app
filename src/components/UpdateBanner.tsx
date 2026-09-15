import React from "react";
import { Linking, Platform, Text, TouchableOpacity, View } from "react-native";
import RefreshCw from "lucide-react-native/dist/esm/icons/refresh-cw";
import X from "lucide-react-native/dist/esm/icons/x";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme/ThemeProvider";
import { spacing } from "../theme/ds";
import { useVersionStore } from "../store/versionStore";
import { DEFAULT_DOWNLOAD_URL } from "../utils/appVersion";

/**
 * "Nova versão disponível", como faixa no topo — nunca como bloqueio.
 *
 * <p>Existe por causa da web: o navegador pode servir um bundle em cache
 * mesmo depois de o site ter sido publicado de novo, e o único jeito de a
 * pessoa saber é alguém avisar. "Atualizar" recarrega a página — é isso que
 * traz a versão nova. No celular a mesma faixa vale como aviso discreto de
 * que existe APK mais novo (a versão atual ainda funciona; quem não funciona
 * mais é barrado pelo gate, não por aqui).
 *
 * <p>Fecha com o X e fica fechada até o próximo início do app: aviso que volta
 * a cada tela ensina a ignorar avisos.
 */
export default function UpdateBanner() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const status = useVersionStore((s) => s.status);
  const info = useVersionStore((s) => s.info);
  const dismissed = useVersionStore((s) => s.bannerDismissed);
  const dismissBanner = useVersionStore((s) => s.dismissBanner);

  if (status !== "update-available" || dismissed) return null;

  const isWeb = Platform.OS === "web";

  const update = () => {
    if (isWeb) {
      if (typeof window !== "undefined") window.location.reload();
      return;
    }
    Linking.openURL(info?.downloadUrl || DEFAULT_DOWNLOAD_URL);
  };

  return (
    <View
      accessibilityLiveRegion="polite"
      // O recuo da barra de status é obrigatório (sem ele o texto fica sob o
      // relógio), mas ele SOMA com a altura da faixa e empurra a tela inteira
      // para baixo -- e a tela abaixo ainda paga o próprio recuo. O dono
      // reclamou justamente disso. A faixa ficou o mais rasa possível: o recuo
      // é o que o sistema exige, e o resto é só a linha.
      style={{
        paddingTop: insets.top,
        backgroundColor: t.background.elevated,
        borderBottomWidth: 1,
        borderBottomColor: t.border.subtle,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing[4],
          // 32 e não 40: são oito pontos que saem do topo de toda tela
          minHeight: 32,
          paddingVertical: spacing[1],
          gap: spacing[2],
        }}
      >
        <RefreshCw size={14} color={t.accent.neon} />
        <Text
          numberOfLines={1}
          style={{ flex: 1, color: t.text.secondary, fontSize: 13 }}
        >
          Nova versão disponível
        </Text>
        <TouchableOpacity
          onPress={update}
          accessibilityRole="button"
          accessibilityLabel={isWeb ? "Atualizar" : "Baixar"}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ paddingVertical: spacing[2], paddingHorizontal: spacing[2] }}
        >
          <Text style={{ color: t.accent.neon, fontSize: 13, fontWeight: "700" }}>
            {isWeb ? "Atualizar" : "Baixar"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={dismissBanner}
          accessibilityRole="button"
          accessibilityLabel="Fechar aviso"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: spacing[1] }}
        >
          <X size={16} color={t.text.tertiary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
