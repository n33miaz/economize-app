import React, { useCallback } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import Download from "lucide-react-native/dist/esm/icons/download";
import RefreshCw from "lucide-react-native/dist/esm/icons/refresh-cw";

import { usePreferencesStore } from "../store/preferencesStore";
import { useVersionStore } from "../store/versionStore";
import { useTheme } from "../theme/ThemeProvider";
import { SHEET_PADDING, SHEET_TITLE, radius, spacing } from "../theme/ds";
import { typography } from "../theme/typography";
import { APP_VERSION, DEFAULT_DOWNLOAD_URL } from "../utils/appVersion";

import CustomModal from "./CustomModal";
import { useAnnouncement } from "../hooks/useAnnouncement";
import { ANNOUNCEMENT_PRIORITY } from "../store/announcementStore";

/** Título da lista de novidades; exportado para o teste cobrar a ausência. */
export const NOTES_TITLE = "O que há de novo";

/**
 * O anúncio de versão nova, uma vez por versão.
 *
 * <p><b>Por que uma folha e não só a faixa.</b> A faixa do topo é discreta de
 * propósito — ela fica, e some quando a pessoa fecha. Só que discreta demais
 * também significa ignorável: o dono publicou a 2.3.1, abriu o app e não
 * percebeu nada. Uma versão nova de um app de dinheiro é notícia, e notícia
 * pede uma tela que a pessoa tenha que responder.
 *
 * <p><b>Uma vez por VERSÃO, não uma vez na vida.</b> A preferência guarda o
 * número anunciado, não um booleano: com booleano o aviso apareceria uma vez e
 * nunca mais, e cada release seguinte ficaria mudo. Fechar aqui não silencia a
 * próxima versão — silencia esta.
 *
 * <p><b>A faixa continua sendo o lembrete.</b> Quem fecha a folha sem
 * atualizar segue vendo a faixa: a folha avisa, a faixa insiste. Sem isso,
 * fechar sem querer significaria perder o aviso até a versão seguinte.
 *
 * <p><b>Notas da versão, quando existirem.</b> O que há de novo vem da API
 * ({@code notes}), escrito pelo operador na hora do release, e entra como
 * lista com marcador entre a explicação e o botão. Sem notas a folha não
 * mostra nem o título: anunciar "novidades" sem dizer quais seria promessa
 * vazia. O corpo é um {@code ScrollView} por causa dela — lista de mudanças
 * cresce, e um texto que cresce dentro de folha sem rolagem empurra o botão
 * para fora da tela.
 */
export default function NewVersionSheet() {
  const t = useTheme();
  const status = useVersionStore((s) => s.status);
  const info = useVersionStore((s) => s.info);
  const seenFor = usePreferencesStore((s) => s.versionNoticeSeenFor);
  const setSeenFor = usePreferencesStore((s) => s.setVersionNoticeSeenFor);

  const publicada = info?.latestVersion ?? null;
  // Só com versão publicada conhecida: sem ela não há o que anunciar, e
  // "versão nova" sem número é aviso que não informa nada
  // O que este anúncio QUER: versão publicada conhecida e ainda não dispensada.
  // Se ele PODE aparecer agora é a fila que decide — três folhas abrindo juntas
  // na abertura do app é o mesmo que nenhuma (ver store/announcementStore)
  const quer =
    status === "update-available" && publicada != null && seenFor !== publicada;
  const visible = useAnnouncement(
    "new-version",
    ANNOUNCEMENT_PRIORITY.newVersion,
    quer,
  );
  // Servidor anterior ao campo não manda `notes`; servidor atual sem notas
  // manda a lista vazia. Os dois casos são o mesmo para a folha: nada a listar
  const notas = info?.notes ?? [];

  const fechar = useCallback(() => {
    if (publicada) setSeenFor(publicada);
  }, [publicada, setSeenFor]);

  const atualizar = useCallback(() => {
    // Na web não há arquivo: o bundle novo vem no recarregamento
    if (Platform.OS === "web") {
      if (publicada) setSeenFor(publicada);
      if (typeof window !== "undefined") window.location.reload();
      return;
    }
    if (publicada) setSeenFor(publicada);
    Linking.openURL(info?.apkUrl || info?.downloadUrl || DEFAULT_DOWNLOAD_URL);
  }, [info?.apkUrl, info?.downloadUrl, publicada, setSeenFor]);

  if (!visible) return null;

  const naWeb = Platform.OS === "web";
  const Icone = naWeb ? RefreshCw : Download;

  return (
    <CustomModal visible={visible} onClose={fechar}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={SHEET_PADDING}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.full,
            backgroundColor: t.accent.neonMuted,
            alignItems: "center",
            justifyContent: "center",
            alignSelf: "center",
            marginBottom: spacing[4],
          }}
        >
          <Icone size={26} color={t.accent.neon} />
        </View>

        <Text
          style={{
            color: t.text.primary,
            fontFamily: "Roboto_700Bold",
            ...SHEET_TITLE,
            textAlign: "center",
          }}
        >
          {`Versão ${publicada} disponível`}
        </Text>

        <Text
          style={{
            color: t.text.secondary,
            fontFamily: "Roboto_400Regular",
            fontSize: 14,
            lineHeight: 20,
            textAlign: "center",
            marginTop: spacing[2],
          }}
        >
          {naWeb
            ? "Recarregue para usar a versão nova. Leva um instante e você não perde nada do que está na tela."
            : "Baixe a versão nova para continuar recebendo as correções. Leva menos de um minuto."}
        </Text>

        {notas.length > 0 && (
          <View
            // Semântica de lista: na web vira <ul>/<li>, e o leitor de tela
            // anuncia "lista, 2 itens" em vez de duas frases soltas
            role="list"
            style={{
              marginTop: spacing[5],
              paddingVertical: spacing[4],
              paddingHorizontal: spacing[4],
              borderRadius: radius.xl,
              backgroundColor: t.background.elevated,
              borderWidth: 1,
              borderColor: t.border.subtle,
            }}
          >
            <Text
              style={{
                ...typography.caption,
                color: t.text.tertiary,
                fontFamily: "Roboto_700Bold",
                letterSpacing: 0.6,
                marginBottom: spacing[3],
              }}
            >
              {NOTES_TITLE}
            </Text>
            {notas.map((nota, indice) => (
              <View
                // A mesma frase pode aparecer duas vezes numa lista escrita à
                // mão; o índice garante a chave única sem esconder a repetição
                key={`${indice}-${nota}`}
                role="listitem"
                // Marcador e frase são UM item para o leitor de tela: sem isto o
                // foco parava no ponto decorativo e depois na frase, separados
                accessible
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  marginTop: indice === 0 ? 0 : spacing[2],
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: radius.full,
                    backgroundColor: t.accent.neon,
                    // Centrado na primeira linha do texto (corpo 14 / entrelinha 20)
                    marginTop: 7,
                    marginRight: spacing[3],
                  }}
                />
                <Text style={{ ...typography.body, flex: 1, color: t.text.primary }}>{nota}</Text>
              </View>
            ))}
          </View>
        )}

        <Pressable
          onPress={atualizar}
          accessibilityRole="button"
          accessibilityLabel={naWeb ? "Recarregar agora" : `Baixar a versão ${publicada}`}
          style={{
            height: 52,
            borderRadius: radius.xl,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.accent.neon,
            marginTop: spacing[6],
          }}
        >
          <Text
            style={{ color: t.text.inverse, fontFamily: "Roboto_700Bold", fontSize: 16 }}
          >
            {naWeb ? "Recarregar agora" : "Baixar agora"}
          </Text>
        </Pressable>

        <Pressable
          onPress={fechar}
          accessibilityRole="button"
          accessibilityLabel="Deixar para depois"
          style={{
            height: 44,
            alignItems: "center",
            justifyContent: "center",
            marginTop: spacing[1],
          }}
        >
          <Text
            style={{ color: t.text.tertiary, fontFamily: "Roboto_700Bold", fontSize: 14 }}
          >
            Depois
          </Text>
        </Pressable>

        <Text
          style={{
            color: t.text.tertiary,
            fontFamily: "Roboto_400Regular",
            fontSize: 12,
            textAlign: "center",
            marginTop: spacing[3],
          }}
        >
          {`Você está na ${APP_VERSION}`}
        </Text>
      </ScrollView>
    </CustomModal>
  );
}
