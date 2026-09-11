import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
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
  const [conferindo, setConferindo] = useState(false);

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

  /**
   * O ARQUIVO quando ele existe; a página quando não (EC-233).
   *
   * Mandar quem já está travado para uma página que diz "em breve" é a pior
   * saída possível. Quando o servidor publica o `apkUrl`, o botão baixa
   * direto; sem ele, a página ainda é melhor que nada, e o rótulo muda para
   * não prometer um download que não vai começar.
   */
  const apk = info?.apkUrl?.trim() || null;
  const downloadUrl = apk ?? info?.downloadUrl ?? DEFAULT_DOWNLOAD_URL;
  const rotuloDoBotao = apk ? "Baixar nova versão" : "Abrir a página de download";

  /**
   * A saída para o caso em que o ERRO é nosso.
   *
   * Com a mínima igual à última publicada (EC-232), um
   * `APP_LATEST_VERSION` configurado errado no servidor tranca TODA instalação
   * — e a pessoa não tem como saber se o problema é dela ou nosso. Este
   * botão não burla o gate: ele só pergunta de novo. Se o servidor
   * continuar recusando, a tela continua.
   */
  const conferirDeNovo = async () => {
    setConferindo(true);
    try {
      await check();
    } finally {
      setConferindo(false);
    }
  };

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
      {/* Entrada suave: a tela aparece por cima de tudo, e um corte seco
          parece pane. 240ms é o bastante para o olho registrar que a tela
          MUDOU sem virar espera */}
      <Animated.View entering={FadeIn.duration(240)} style={{ marginBottom: spacing[8] }}>
        <PotIcon size={112} level={0.75} animate />
      </Animated.View>

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

      <Animated.View
        entering={FadeInDown.duration(280).delay(80)}
        style={{ width: "100%", maxWidth: 320, alignItems: "center" }}
      >
        <TouchableOpacity
          onPress={() => Linking.openURL(downloadUrl)}
          activeOpacity={0.85}
          accessibilityLabel={rotuloDoBotao}
          accessibilityRole="button"
          style={{
            width: "100%",
            backgroundColor: t.accent.neon,
            paddingVertical: spacing[4],
            borderRadius: radius.full,
            alignItems: "center",
          }}
        >
          <Text
            style={{ color: t.text.inverse, fontWeight: "700", fontSize: 16 }}
          >
            {rotuloDoBotao}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={conferirDeNovo}
          disabled={conferindo}
          activeOpacity={0.7}
          accessibilityLabel="Conferir de novo"
          accessibilityRole="button"
          accessibilityState={{ disabled: conferindo }}
          style={{
            marginTop: spacing[3],
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing[2],
          }}
        >
          {conferindo ? <ActivityIndicator size="small" color={t.text.secondary} /> : null}
          <Text style={{ color: t.text.secondary, fontSize: 14, fontWeight: "700" }}>
            {conferindo ? "Conferindo…" : "Conferir de novo"}
          </Text>
        </TouchableOpacity>
      </Animated.View>

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
