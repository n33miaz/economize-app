import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import CloudMoon from "lucide-react-native/dist/esm/icons/cloud-moon";

import { useServerStore } from "../store/serverStore";
import { useTheme } from "../theme/ThemeProvider";
import { radius, shadow, spacing } from "../theme/ds";

// Enquanto a API hibernada sobe, qualquer tela fica sem dado e o botão parece
// travado. Este aviso é a diferença entre "o app quebrou" e "o servidor está
// acordando" — o mesmo padrão adotado no LumiLivre.
export default function ServerWakeOverlay() {
  const t = useTheme();
  const isWaking = useServerStore((s) => s.isWaking);
  const waitedSeconds = useServerStore((s) => s.waitedSeconds);

  if (!isWaking) return null;

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: t.background.overlay,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing[5],
        zIndex: 9998,
        // Não é diálogo de decisão: só informa, e some sozinho quando a API
        // responde. No estilo porque `props.pointerEvents` está depreciado
        pointerEvents: "auto",
      }}
      accessibilityLiveRegion="polite"
    >
      <View
        style={[
          {
            width: "100%",
            maxWidth: 380,
            backgroundColor: t.background.elevated,
            borderRadius: radius["2xl"],
            borderWidth: 1,
            borderColor: t.border.default,
            padding: spacing[6],
            alignItems: "center",
          },
          shadow.lg,
        ]}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.full,
            backgroundColor: t.accent.neonMuted,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing[4],
          }}
        >
          <CloudMoon size={30} color={t.accent.neon} />
        </View>

        <Text
          style={{
            color: t.text.primary,
            fontFamily: "Roboto_700Bold",
            fontSize: 18,
            marginBottom: spacing[2],
            textAlign: "center",
          }}
        >
          Acordando o servidor
        </Text>

        <Text
          style={{
            color: t.text.secondary,
            fontFamily: "Roboto_400Regular",
            fontSize: 14,
            lineHeight: 20,
            textAlign: "center",
            marginBottom: spacing[5],
          }}
        >
          A hospedagem gratuita coloca a API para dormir depois de alguns
          minutos parada. O primeiro acesso leva até um minuto — os próximos são
          instantâneos.
        </Text>

        <ActivityIndicator color={t.accent.neon} />

        {waitedSeconds > 0 ? (
          <Text
            style={{
              color: t.text.tertiary,
              fontFamily: "Roboto_400Regular",
              fontSize: 12,
              marginTop: spacing[3],
            }}
          >
            {`aguardando há ${waitedSeconds}s`}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
