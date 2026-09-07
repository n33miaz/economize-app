import React, { useEffect, useRef } from "react";
import { AppState, Linking, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PotIcon from "./PotIcon";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { useVersionStore } from "../store/versionStore";
import { APP_VERSION, DEFAULT_DOWNLOAD_URL } from "../utils/appVersion";

interface Props {
  children: React.ReactNode;
}

/**
 * Depois de tanto tempo em segundo plano, a versão é conferida de novo ao
 * voltar. Seis horas: menos que isso é um dia de uso normal com alt-tab, e a
 * mínima não muda várias vezes por dia.
 */
const RECHECK_AFTER_BACKGROUND_MS = 6 * 60 * 60 * 1000;

/**
 * Versão abaixo da mínima: nada do app antes de atualizar.
 *
 * <p>Vem ANTES da tranca e do login de propósito: se o servidor não fala mais
 * com esta versão, nem a tela de login funcionaria — e falhar no login com
 * "erro ao conectar" é a pior mensagem possível para quem só precisa baixar o
 * APK novo. Não tem "agora não" porque não há o que fazer sem atualizar: a
 * saída honesta é o botão de download.
 *
 * <p>Mesma linguagem visual da tela de biometria — fundo do app, o pote, uma
 * linha de porquê, um botão. É o app dizendo "estou parado", não um aviso
 * flutuando por cima de algo que funciona.
 *
 * <p>Na web este gate NUNCA bloqueia (o store não chega a "upgrade-required"
 * lá): o bundle novo vem no reload, e quem avisa é a `UpdateBanner`.
 */
export default function UpdateRequiredGate({ children }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const status = useVersionStore((s) => s.status);
  const info = useVersionStore((s) => s.info);
  const check = useVersionStore((s) => s.check);
  const backgroundedAt = useRef<number | null>(null);

  // Na abertura, sempre — a resposta de ontem não vale hoje
  useEffect(() => {
    check();
  }, [check]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        backgroundedAt.current = Date.now();
        return;
      }
      if (next !== "active" || backgroundedAt.current == null) return;
      const elapsed = Date.now() - backgroundedAt.current;
      backgroundedAt.current = null;
      if (elapsed >= RECHECK_AFTER_BACKGROUND_MS) {
        useVersionStore.getState().check();
      }
    });
    return () => subscription.remove();
  }, []);

  if (status !== "upgrade-required") return <>{children}</>;

  const downloadUrl = info?.downloadUrl || DEFAULT_DOWNLOAD_URL;

  return (
    <View
      accessibilityViewIsModal
      style={{
        flex: 1,
        backgroundColor: t.background.base,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing[6],
        paddingTop: insets.top,
        paddingBottom: insets.bottom + spacing[6],
      }}
    >
      <View style={{ marginBottom: spacing[8] }}>
        <PotIcon size={112} level={0.75} />
      </View>

      <Text
        accessibilityRole="header"
        style={{
          color: t.text.primary,
          fontSize: 22,
          fontWeight: "700",
          textAlign: "center",
        }}
      >
        Atualize o Economize!
      </Text>
      <Text
        style={{
          color: t.text.secondary,
          fontSize: 15,
          lineHeight: 22,
          textAlign: "center",
          marginTop: spacing[3],
          marginBottom: spacing[8],
          maxWidth: 320,
        }}
      >
        Esta versão não conversa mais com o servidor. Baixe a nova em menos de
        um minuto.
      </Text>

      <TouchableOpacity
        onPress={() => Linking.openURL(downloadUrl)}
        activeOpacity={0.85}
        accessibilityLabel="Baixar nova versão"
        accessibilityRole="button"
        style={{
          width: "100%",
          maxWidth: 320,
          backgroundColor: t.accent.neon,
          paddingVertical: spacing[4],
          borderRadius: radius.full,
          alignItems: "center",
        }}
      >
        <Text
          style={{ color: t.text.inverse, fontWeight: "700", fontSize: 16 }}
        >
          Baixar nova versão
        </Text>
      </TouchableOpacity>

      <Text
        style={{
          color: t.text.tertiary,
          fontSize: 13,
          textAlign: "center",
          marginTop: spacing[6],
          fontVariant: ["tabular-nums"],
        }}
      >
        Você tem a versão {APP_VERSION}
        {info?.minVersion ? ` · a mínima é ${info.minVersion}` : ""}
      </Text>
    </View>
  );
}
